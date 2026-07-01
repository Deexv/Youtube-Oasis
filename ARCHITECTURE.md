# Architecture

Shorts Pilot is a single-user, self-hosted YouTube scheduler. It runs as a
Next.js 16 app with an embedded SQLite database. All YouTube and LLM calls
happen server-side. Package manager: **pnpm**.

**v0.2 highlights**: multi-account YouTube OAuth, real file uploads, per-provider
LLM model overrides, dynamic SDK imports for memory efficiency.

## High-level diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (client)                            │
│                                                                     │
│  AppShell (sidebar + header)                                        │
│    └─ Dashboard                                                     │
│         ├─ Overview tab    (stats, charts, queue, upcoming)         │
│         ├─ Create tab      (upload long-form + generate shorts)     │
│         ├─ Long-form tab   (table + generate shorts)                │
│         ├─ Shorts tab      (table with beat tags + account badge)   │
│         ├─ Upcoming tab    (day-grouped timeline)                   │
│         └─ Settings tab    (limits, window, API keys, YouTube accts)│
└──────────────────────────────┬──────────────────────────────────────┘
                               │ fetch /api/*
┌──────────────────────────────┴──────────────────────────────────────┐
│                    Next.js API routes (server)                      │
│                                                                     │
│  /api/upload          POST (multipart file upload with progress)    │
│  /api/long-form       GET (list) · POST (create + schedule)         │
│  /api/shorts          GET (list)                                    │
│  /api/shorts/generate POST (detect moments + generate + schedule)   │
│  /api/schedule        GET (upcoming long+short merged)              │
│  /api/settings        GET · POST (limits, window, uploadLimitMb)    │
│  /api/status          GET (provider models + YouTube status)        │
│  /api/youtube/auth    GET (redirect to Google OAuth)                │
│  /api/youtube/callback GET (OAuth code → store account)             │
│  /api/youtube/accounts GET (list) · DELETE (disconnect)             │
│  /api/youtube/accounts-default POST (set default account)           │
│  /api/youtube/schedule POST (manual reschedule)                     │
│  /api/seed            POST (demo data)                              │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────┴──────────────────────────────────────┐
│                           Lib layer                                 │
│                                                                     │
│  scheduler.ts        Random time in window, daily caps, 2h spacing  │
│  shorts-pipeline.ts  detect → header → DB → schedule → YouTube      │
│  zai.ts              Moment detection + header generation           │
│  llm.ts              Multi-provider client (Z.AI/Groq/Gemini/Claude) │
│  youtube.ts          Real YouTube Data API v3 (videos.insert)       │
│  beats.ts            6-beat narrative pattern constants             │
│  db.ts               Prisma client                                  │
└──────────────┬───────────────────────────────────┬──────────────────┘
               │                                   │
       ┌───────┴───────┐                  ┌─────────┴─────────┐
       │   SQLite DB   │                  │   External APIs   │
       │  (Prisma)     │                  │                   │
       │               │                  │  YouTube Data v3  │
       │ LongFormVideo │                  │  Z.AI / Groq /    │
       │ Short         │                  │  Gemini / Claude  │
       │ Setting       │                  │                   │
       └───────────────┘                  └───────────────────┘
```

## Request lifecycle

### Create + schedule a long-form video

```
User clicks "Schedule on YouTube" in the New long-form dialog
  │
  ▼
POST /api/long-form
  body: { title, filePath, duration, transcript, windowStart, windowEnd, scheduleNow }
  │
  ▼
lib/scheduler.ts: findNextLongFormDay(now, settings)
  → skips days that already have longFormPerDay scheduled
  → returns the next available day
  │
  ▼
lib/scheduler.ts: pickRandomTimeInWindow(day, windowStart, windowEnd)
  → picks a biased-random time inside [09:00, 17:00]
  → returns a Date
  │
  ▼
lib/youtube.ts: scheduleOnYouTube({ title, filePath, scheduledTime, ... })
  → exchanges refresh_token for access_token (googleapis OAuth2)
  → streams the video file to YouTube via videos.insert
  → sets status.privacyStatus = "private", status.publishAt = RFC3339
  → returns { youtubeId, mock: false }
  │
  ▼
db.longFormVideo.create({ ...scheduledTime, youtubeId, status: "scheduled" })
  │
  ▼
Response: { item: { id, title, scheduledTime, status, youtubeId } }
  │
  ▼
Client toast: "Long-form scheduled on YouTube · 14:21"
Client bumpRefresh() → all charts/tables refetch
```

If YouTube upload fails (e.g. OAuth not configured, quota exceeded):
- The exception is caught in `/api/long-form`
- The video is stored with `status: "failed"`, `youtubeId: null`
- The API returns HTTP 200 (not an error)
- The client checks `d.item.status === "failed"` and shows an error toast

### Generate shorts from a long-form video

```
User clicks "Generate shorts" on a long-form row
  │
  ▼
POST /api/shorts/generate
  body: { longFormId, autoSchedule: true }
  │
  ▼
lib/shorts-pipeline.ts: generateShortsFromLongForm(longFormId)
  │
  ├─ db.longFormVideo.findUnique(longFormId)
  │    → loads transcript + duration
  │
  ├─ lib/zai.ts: detectMoments(transcript, duration)
  │    → lib/llm.ts: chatJson({ system: 6-BEAT_PROMPT, user: transcript })
  │    → picks next provider via rotationCursor (zai → groq → gemini → anthropic)
  │    → on failure, tries the next configured provider
  │    → parses JSON, normalizes each moment (clamps sourceStart/sourceEnd)
  │    → returns DetectedMoment[] (up to 6, one per beat)
  │
  ├─ for each moment:
  │    ├─ lib/zai.ts: generateShortHeader(moment)
  │    │    → lib/llm.ts: chatJson({ system: HEADER_PROMPT, user: moment })
  │    │    → returns viral header ≤60 chars
  │    │
  │    ├─ lib/scheduler.ts: findNextShortSlot(cursor, settings)
  │    │    → scans forward day by day
  │    │    → on each day, tries 30-min slots from 09:00 to 21:00
  │    │    → skips slots within minSpacingMinutes of any existing scheduled short
  │    │    → skips days that already have shortsPerDay scheduled
  │    │    → returns { iso, day }
  │    │    → cursor advances past the chosen slot
  │    │
  │    ├─ db.short.create({ beat, title, header, scheduledTime, ... })
  │    │
  │    └─ lib/youtube.ts: scheduleOnYouTube({ title: header, ... })
  │         → uploads the short to YouTube with publishAt
  │         → on success: db.short.update({ youtubeId, status: "scheduled" })
  │         → on failure: db.short.update({ status: "failed" })
  │
  ▼
Response: { created: [...6 shorts], scheduledCount, totalDurationSec }
  │
  ▼
Client toast: "Created 6 shorts · 6 scheduled on YouTube"
Client bumpRefresh()
```

### Dashboard data load

Every chart and table fetches from `/api/schedule` (the merged upcoming
queue) or `/api/long-form` / `/api/shorts`. The `useDashboardStore`
Zustand store holds a `refreshKey` that is bumped after every mutation,
triggering a refetch via `useEffect` dependencies.

## Data model

```prisma
model LongFormVideo {
  id            String   @id @default(cuid())
  title         String
  description   String?
  filePath      String          // local path or HTTP URL
  duration      Int      @default(0)  // seconds
  transcript    String?         // used for shorts moment detection
  windowStart   String   @default("09:00")  // HH:mm
  windowEnd     String   @default("17:00")
  scheduledTime String?         // ISO, null = draft
  status        String   @default("draft")  // draft|scheduled|uploaded|failed
  youtubeId     String?
  shorts        Short[]
}

model Short {
  id            String   @id @default(cuid())
  longFormId    String
  longForm      LongFormVideo @relation(...)
  beat          String   @default("hook")  // hook|rising|conflict|comeback|tension|reveal
  title         String
  header        String?         // viral-style caption ≤60 chars
  description   String?
  filePath      String          // source#t=start,end
  sourceStart   Int      @default(0)  // seconds in source
  sourceEnd     Int      @default(0)
  duration      Int      @default(0)
  scheduledTime String?
  status        String   @default("draft")
  youtubeId     String?
  subtitleStyle String   @default("pop")
  accountId     String?
  account       YouTubeAccount? @relation(...)
}

model YouTubeAccount {
  id            String   @id @default(cuid())
  displayName   String
  channelId     String?  @unique
  avatarUrl     String?
  refreshToken  String              // OAuth refresh token (stored in DB)
  accessToken   String?
  tokenExpiresAt DateTime?
  color         String   @default("#ef4444")  // for the account selector
  isDefault     Boolean  @default(false)
  longForms     LongFormVideo[]
  shorts        Short[]
}

model Setting {
  key   String @id          // "scheduling"
  value String              // JSON blob (includes uploadLimitMb)
}
```

## LLM provider rotation

```
chatJson({ system, user })
  │
  ├─ getConfiguredProviders()
  │    → filters PROVIDER_ORDER by which env keys are set
  │    → returns e.g. ["zai", "groq", "anthropic"]
  │
  ├─ pickNextProvider()
  │    → if rotation disabled: return configured[0]
  │    → else: return configured[rotationCursor % configured.length]
  │    → rotationCursor += 1
  │
  ├─ attemptOrder = [pick, ...configured.filter(!= pick)]
  │
  ├─ for provider in attemptOrder:
  │    try:
  │      callProvider(provider, input)
  │        → callZai / callGroq / callGemini / callAnthropic
  │        → each uses response_format: json_object (or equivalent)
  │        → returns { content, model }
  │      return { content, provider, model }
  │    catch:
  │      continue  // try next provider
  │
  └─ throw "All configured LLM providers failed"
```

The rotation cursor is module-level state, scoped to the server process.
For multi-instance deployments, move it to Redis.

## YouTube upload flow (real)

```
scheduleOnYouTube(input)
  │
  ├─ if YOUTUBE_MOCK_MODE === "true":
  │    return { youtubeId: fakeId, mock: true }
  │
  ├─ if !isYouTubeConfigured():
  │    throw "YouTube is not configured. Set YOUTUBE_CLIENT_ID, ..."
  │
  ├─ getOAuth2Client()
  │    → new google.auth.OAuth2(clientId, clientSecret, "urn:ietf:wg:oauth:2.0:oob")
  │    → setCredentials({ refresh_token })
  │
  ├─ resolve bodyStream:
  │    → if filePath starts with http(s)://: fetch as stream
  │    → else: fs.createReadStream(filePath)
  │
  ├─ youtube.videos.insert({
  │    part: ["snippet", "status"],
  │    requestBody: {
  │      snippet: { title, description, tags, categoryId },
  │      status: { privacyStatus: "private", publishAt: RFC3339 }
  │    },
  │    media: { body: bodyStream }
  │  })
  │    → googleapis auto-refreshes the access_token using the refresh_token
  │    → resumable upload (supports up to 256GB)
  │
  └─ return { youtubeId: insertRes.data.id, mock: false }
```

## Client/server boundary

The `*-shared.ts` files (`beats.ts`, `llm-shared.ts`, `youtube-shared.ts`)
contain only constants and pure functions. They are safe to import from
client components without pulling in Node-only SDK packages
(`googleapis`, `@google/genai`, `@anthropic-ai/sdk`, `z-ai-web-dev-sdk`,
`openai`).

The non-shared files (`llm.ts`, `youtube.ts`, `zai.ts`, `shorts-pipeline.ts`,
`scheduler.ts`) are server-only and must only be imported from `route.ts`
files or other server-only libs.
