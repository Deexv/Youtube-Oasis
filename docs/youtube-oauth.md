# YouTube OAuth setup

This scheduler uploads videos natively to YouTube using the **YouTube Data API v3**
(`videos.insert` with `status.publishAt`). To do that you need three pieces of
information in your `.env`:

```
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
YOUTUBE_REFRESH_TOKEN=
```

The `CLIENT_ID` / `CLIENT_SECRET` come from a Google Cloud OAuth credential.
The `REFRESH_TOKEN` is a long-lived token (does not expire unless revoked)
that you obtain once by running the OAuth flow.

## Step 1 — Create the Google Cloud project

1. Go to <https://console.cloud.google.com/>.
2. Create a new project (or reuse an existing one).
3. Open **APIs & Services → Library**, search for **YouTube Data API v3**,
   and click **Enable**.

## Step 2 — Create the OAuth credential

1. Open **APIs & Services → OAuth consent screen**.
2. Choose **External** (unless you have a Google Workspace), fill in the
   app name and your email, save.
3. Add yourself as a **Test user** (required while the app is in "Testing"
   status — otherwise token exchange fails with `access_denied`).
4. Open **APIs & Services → Credentials → Create credentials → OAuth client ID**.
5. Choose **Desktop app** as the application type. (Not "Web application" —
   the desktop flow is what produces a long-lived refresh token without a
   publicly-hosted redirect URI.)
6. Note the **Client ID** and **Client Secret** — these go into
   `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET` in `.env`.

## Step 3 — Obtain the refresh token

The easiest no-code way is the official [OAuth Playground](https://developers.google.com/oauthplayground):

1. Open <https://developers.google.com/oauthplayground>.
2. Click the **gear icon** (top-right) → check **"Use your own OAuth credentials"**.
3. Paste your **Client ID** and **Client Secret**.
4. In the left panel, scroll to **YouTube Data API v3**, expand it, and
   check `https://www.googleapis.com/auth/youtube.upload`.
5. Click **"Authorize APIs"** — you'll be redirected to Google's consent
   screen. Approve.
6. Back in the playground, click **"Exchange authorization code for tokens"**.
7. The **Refresh token** field appears — copy this value into
   `YOUTUBE_REFRESH_TOKEN` in `.env`.

The refresh token is long-lived. It will keep working until:

- You revoke it from <https://myaccount.google.com/permissions>.
- You change your Google account password.
- The OAuth consent screen app is deleted.

## Step 4 — Verify

Set `YOUTUBE_MOCK_MODE=false` in `.env` (the default) and restart the dev
server. The Settings tab should now show **"Live mode"** with an **"OAuth
ready"** badge.

Create a long-form video with a real file path (local path or HTTP URL) and
click **Schedule on YouTube**. Within a minute or two the video will appear
as **Private** in your YouTube Studio with a scheduled publish time.

## Scopes used

| Scope | Why |
|-------|-----|
| `https://www.googleapis.com/auth/youtube.upload` | Upload videos via `videos.insert`. |

That's the only scope we request. We never read your watch history, channel
analytics, or any other YouTube data.

## Troubleshooting

| Error | Fix |
|-------|-----|
| `access_denied` | Add your Google account email as a Test user on the OAuth consent screen. |
| `invalid_grant` | The refresh token is stale — re-run Step 3. |
| `quotaExceeded` | YouTube's default upload quota is 10,000 units/day. Each `videos.insert` costs ~1600 units. If you hit this you need to request a quota increase from Google Cloud Console. |
| `uploadNotPermitted` | Your channel has fewer than the required subscriber threshold, or the video content violates YouTube policy. |
