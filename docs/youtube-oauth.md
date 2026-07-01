# YouTube OAuth setup

Shorts Pilot includes an **in-app setup wizard** — you don't need to edit
`.env` or use the OAuth Playground. Just open the Settings tab, follow the
4-step wizard, paste your Google OAuth credentials, and click "Connect with
Google".

## The fast way (in-app wizard)

1. Open the app at `http://localhost:3000`.
2. Go to the **Settings** tab.
3. Scroll to the **YouTube accounts** card.
4. If OAuth isn't configured yet, you'll see a **"One-time setup required"**
   wizard with 4 numbered steps:
   - **Step 1**: Link to Google Cloud Console (enable YouTube Data API v3)
   - **Step 2**: Link to create an OAuth client ID (Web application type)
   - **Step 3**: Copy-paste the redirect URI into Google Cloud
   - **Step 4**: Paste your Client ID + Client Secret, click **Save credentials**
5. Once saved, the wizard disappears and a **"Connect with Google"** button
   appears. Click it, log in with your Google account, and your YouTube
   channel is connected.

The credentials are stored in the app's SQLite database (not in `.env`),
so they persist across restarts. You only need to do this once.

## The manual way (.env)

If you prefer editing `.env` directly (e.g. for CI/CD or headless servers),
set these vars:

```bash
YOUTUBE_CLIENT_ID=your-client-id.apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET=your-client-secret
YOUTUBE_REDIRECT_URI=http://localhost:3000/api/youtube/callback
```

The app reads from the DB first, then falls back to env vars. So you can
use either method (or both — DB takes priority).

---

## Detailed Google Cloud setup (if you need to do it manually)

### Step 1 — Create the Google Cloud project

1. Go to <https://console.cloud.google.com/>.
2. Create a new project (or reuse an existing one).
3. Open **APIs & Services → Library**, search for **YouTube Data API v3**,
   and click **Enable**.

## Step 2 — Create the OAuth credential (one-time)

1. Open **APIs & Services → OAuth consent screen**.
2. Choose **External**, fill in the app name and your email, save.
3. Add yourself as a **Test user** (required while the app is in "Testing"
   status).
4. Open **APIs & Services → Credentials → Create credentials → OAuth client ID**.
5. Choose **Web application** as the type (not "Desktop app" — v0.2 uses
   the web flow with a redirect URI).
6. Under **Authorized redirect URIs**, add:
   - `http://localhost:3000/api/youtube/callback` (for local dev)
   - `https://your-domain.com/api/youtube/callback` (for production)
7. Note the **Client ID** and **Client Secret** — these go into
   `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET` in `.env`.

## Step 3 — Configure `.env`

```bash
YOUTUBE_CLIENT_ID=your-client-id.apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET=your-client-secret
YOUTUBE_REDIRECT_URI=http://localhost:3000/api/youtube/callback
YOUTUBE_MOCK_MODE=false
```

Restart the dev server: `npm run dev`.

## Step 4 — Add a YouTube account (in-app)

1. Open the app at `http://localhost:3000`.
2. Go to the **Settings** tab.
3. Scroll to the **YouTube accounts** card.
4. Click **Add YouTube account**.
5. You'll be redirected to Google's OAuth consent screen.
6. Log in with the Google account that owns your YouTube channel.
7. Grant the `youtube.upload` scope.
8. Google redirects back to the app — your channel is now connected with
   a distinct color.

Repeat for additional channels. Each gets a different color from the
palette (red, orange, yellow, green, cyan, blue, violet, pink).

## Step 5 — Select an account when scheduling

When you upload a long-form video or generate shorts, the **Create** tab
shows an account selector. Pick the channel you want to post to. A colored
banner appears below the dropdown confirming your choice:

> Posting as **Your Channel Name** — videos will appear on this channel.

This is the anti-mistake mechanism: the color matches the dot shown in the
Settings tab, so you can verify at a glance which channel you're posting to.

## Scopes used

| Scope | Why |
|-------|-----|
| `https://www.googleapis.com/auth/youtube.upload` | Upload videos via `videos.insert`. |
| `https://www.googleapis.com/auth/youtube` | Read channel info (display name, avatar). |

We never read your watch history, channel analytics, or any other YouTube data.

## Revoke access

To disconnect an account:

1. In the app: Settings → YouTube accounts → trash icon (removes the token from the app's DB).
2. At Google: visit <https://myaccount.google.com/permissions> and remove the app (revokes the refresh token at Google's side).

Step 2 is important if you suspect the token has been compromised — the
app's DB deletion alone does not revoke the token at Google.

## Troubleshooting

| Error | Fix |
|-------|-----|
| `redirect_uri_mismatch` | The redirect URI in `.env` doesn't match what's in Google Cloud. Make sure `YOUTUBE_REDIRECT_URI` exactly matches one of the authorized redirect URIs. |
| `access_denied` | Add your Google account email as a Test user on the OAuth consent screen. |
| `invalid_grant` | The refresh token is stale — disconnect the account in the app and re-add it. |
| `No YouTube channel found` | The Google account doesn't have a YouTube channel. Create one at youtube.com first. |
| `quotaExceeded` | YouTube's default upload quota is 10,000 units/day. Each `videos.insert` costs ~1600 units. Request a quota increase from Google Cloud Console if needed. |

## Multiple accounts

You can connect as many YouTube channels as you want. Each gets a distinct
color. When scheduling, the account selector shows all of them with their
colors and avatars. Set a default account for quick scheduling (the
default is pre-selected in the Create tab).

The color palette wraps after 8 accounts (the 9th account gets the same
color as the 1st). For a single user, 8 channels is more than enough.
