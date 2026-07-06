# Flow — AI Focus Discovery MVP

People who listen while doing cognitively demanding work (coding, studying, reading)
loop the same familiar playlists for hours, because unfamiliar or acoustically
unpredictable music breaks concentration — so discovery dies during their biggest
listening block. **Flow** keeps a focus session sonically consistent, quietly works in
a few taste-adjacent new tracks, and surfaces a discovery recap when attention is free
(on re-entry, never mid-session).

Any visitor can use the live app end-to-end with **no login**: generate a session, hear
every track in the browser, and save discoveries to a real public Spotify playlist.

> **Live app:** https://flow-spotify.vercel.app · Build plan:
> [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) · Edge-case matrix:
> [docs/EDGE_CASES.md](docs/EDGE_CASES.md)

## How it works (LLM + Search hybrid)

There is no traditional recommender here — Spotify's recommendations and audio-features
APIs are deprecated for new apps. Instead:

| Role | Piece |
| --- | --- |
| **The brain** | Groq (`llama-3.3-70b-versatile`) parses the preset + entry context and returns a structured JSON tracklist: consistent energy, novelty dosed by the adventure dial, one-line reason per track, plus backfill alternates. |
| **The fact-checker** | Spotify Search (client-credentials, app-level) resolves every LLM-named track to a real track — id, album art, link — with an artist-verification guard. Misses are dropped and backfilled. |
| **The speakers** | Spotify's consumer IFrame Embed player, docked like a mini-player. No login, no API key, works for any visitor. Auto-advances at track end; a plain per-track embed is the fallback. |
| **The save path** | One shared public playlist ("Flow Discoveries") owned by the app owner. The server acts as the owner via a stored refresh token, so visitors never OAuth (and Spotify's 5-user dev-mode cap never applies). |

The product rules are enforced **in code**, not just prompted: exact novelty count per
dial level, sessions always open familiar, no two new tracks adjacent, non-resolving
discoveries topped up from spares, everything deduped.

**Security**: all secrets stay server-side in Next.js API routes ([lib/env.ts](lib/env.ts)
is the only module that reads them, and it throws if imported in the browser). The
client only ever sees resolved track metadata.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in the keys below
npm run dev                  # http://localhost:3000
npm test                     # 70 unit/edge-case tests (mocked network, no keys needed)
```

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `GROQ_API_KEY` | yes | Session + recap generation ([console.groq.com](https://console.groq.com)) |
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | yes | Track search via client credentials ([developer dashboard](https://developer.spotify.com/dashboard); add redirect URI `http://127.0.0.1:8080`) |
| `SPOTIFY_REFRESH_TOKEN`, `SPOTIFY_PLAYLIST_ID` | no | Shared-playlist Save. If unset, the app runs fine and simply hides Save. |

`GET /api/health` reports what's configured; `GET /api/health?live=1` pings both APIs.

### One-time Save setup (owner only)

```bash
node scripts/get-refresh-token.mjs
```

This walks the Authorization Code flow once as the playlist owner
(scope `playlist-modify-public`, redirect `http://127.0.0.1:8080`), finds or creates
the public **Flow Discoveries** playlist, and prints the two env values to paste into
`.env.local` / your host. Visitors never log in — the server always acts as the owner,
deduping so a track is never added twice.

> Note: this app uses Spotify's **post-February-2026** playlist endpoints
> (`POST /me/playlists`, `/playlists/{id}/items`). The legacy
> `/users/{id}/playlists` and `/playlists/{id}/tracks` paths return 403 for all
> apps since the March 2026 migration deadline.

## Deploy (Vercel)

1. Push this repo to GitHub and import it in Vercel (defaults are fine).
2. Add the env vars above in Project Settings → Environment Variables.
3. Deploy, then verify in a fresh incognito window: tracks play via the embed with no
   login, and "Save all" in the recap updates the public playlist.

## Testing

- `npm test` — 70 vitest cases covering the edge-case checklist in
  [docs/EDGE_CASES.md](docs/EDGE_CASES.md): API failures, invalid LLM output, quote-breaking
  titles, novelty dosing/caps, dedupe, save dedupe, corrupted localStorage, radial
  geometry, and more.
- Live end-to-end runs (headless Chrome against real APIs) verified the full core loop,
  the radial gesture and its accessible fallback, entry states A/B/C payloads, and the
  player fallback. All four screens score **100 on Lighthouse accessibility**.

## Design notes

- Mobile-first at 390px, dark and low-stimulation to match the focus thesis; a single
  green accent family, with `#1DB954` reserved for large fills and `#1ED760` for
  text/icons so AA contrast holds on dark surfaces.
- Meaning is never conveyed by color alone — the "New" tag is icon + text.
- Reduce-motion preference (system `prefers-reduced-motion` and an in-app toggle),
  ≥44px touch targets, aria labels throughout, and every gesture has a plain-list
  equivalent (the radial is progressive enhancement).

## Honest limitations & roadmap

This is an MVP with deliberate, documented proxies:

- **"New to you" is a heuristic.** With client-credentials there is no user listening
  history, so discoveries are tracks the LLM marks as outside your seed artists. A real
  build would use actual history.
- **No accounts.** Presets, per-preset taste, Discoveries, and the deferred recap live
  in `localStorage` (zod-validated, versioned keys). A real product would use accounts;
  this keeps the demo login-free.
- **Entry states B/C read this app's player**, not your real Spotify playback — the
  Web Playback SDK needs per-user Premium OAuth, capped at 5 users in dev mode.
- **Learning is single-signal.** Skipping a new track quietly lowers future novelty
  (clamped, drifts back on calm sessions). A real multi-session learning loop —
  per-track embeddings, acceptance-rate tuning, time-of-day context — is roadmap.
- **Playback is 30-second previews** for visitors without an active Spotify session in
  the browser; full tracks play for logged-in Spotify users. That's a constraint of the
  consumer embed (and why "Open in Spotify" is always one tap away).
