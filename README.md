# Flow — AI Focus Discovery MVP

Focus listeners loop the same familiar playlists for hours because unfamiliar or
unpredictable music breaks concentration — so discovery dies during their biggest
listening block. **Flow** keeps a focus session sonically consistent, quietly works in a
few taste-adjacent new tracks, and surfaces a discovery recap when attention is free
(on re-entry, never mid-session).

> Status: in development. See [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) for the
> phase-wise build plan.

## Architecture (LLM + Search hybrid)

No traditional recommender — Spotify's recommendation/audio-features APIs are
deprecated for new apps. Instead:

- **Groq LLM** (`llama-3.3-70b-versatile`) is the brain: parses intent, generates a
  consistent tracklist, doses novelty, writes per-track reasons and the recap.
- **Spotify Search** (client-credentials, no user login) is the fact-checker: every
  LLM-named track is resolved to a real track (id, art, link); misses are dropped and
  backfilled.
- **Spotify Embed player** lets any visitor hear tracks in-browser with no login.
- **Save** adds discoveries to one shared public "Flow Discoveries" playlist owned by
  the app owner (stored refresh token) — no visitor OAuth needed.

All secrets stay server-side in Next.js API routes.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in keys (see .env.example comments)
npm run dev
```

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `GROQ_API_KEY` | yes | LLM session generation |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | yes | Track search (client credentials) |
| `SPOTIFY_REFRESH_TOKEN` | no | Shared-playlist Save (Save hides if unset) |
| `SPOTIFY_PLAYLIST_ID` | no | The "Flow Discoveries" playlist |

## Roadmap & limitations

_To be completed in the final phase — will cover: the `is_new` heuristic (no real
listening history without login), localStorage instead of accounts, the single-session
learning loop, in-app full playback, and Spotify's 5-user OAuth dev-mode cap._
