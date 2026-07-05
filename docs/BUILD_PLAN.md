# Flow — AI Focus Discovery MVP: Phase-wise Build Plan

## Context

Mourya is a PM on Spotify's Growth team building a graded, publicly deployed MVP called **Flow**: a mobile-first web app that keeps a focus-listening session sonically consistent, quietly doses in a few taste-adjacent new tracks, and defers the discovery recap until the user's attention is free. The insight: focus listeners loop familiar playlists because unpredictable music breaks concentration — so discovery must be invisible during the session and reviewable after.

The repo will be **public and deployed live** (graders open it in incognito), so hygiene, security (no secrets client-side), accessibility (WCAG AA), and an honest README are graded requirements, not polish.

This plan follows the spec in `Flow_MVP_FINAL_BuildPrompt.md` with three confirmed refinements (user approved 2026-07-06):
1. **Single sticky embed player** (Spotify IFrame Embed API) instead of one iframe per track — lighter, matches Spotify's mini-player pattern from the reference screenshots, enables auto-advance and skip detection.
2. **Node token helper** (`scripts/get-refresh-token.mjs`) instead of Python — single-language repo.
3. This plan ships in the repo as `docs/BUILD_PLAN.md`.

## Architecture summary

```
Browser (Next.js client, mobile-first ~390px, dark Spotify-like UI)
  │  localStorage: presets, per-preset taste, discoveries, favourites,
  │                most-recent preset, pending recap, novelty nudges
  │
  ├── Spotify IFrame Embed API (client-side, consumer embed, no login,
  │     no secret) — single docked player; loadUri() to switch tracks,
  │     playback_update events → auto-advance + skip signal
  │
  └── Next.js API routes (ALL secrets live here, server-side only)
        ├── POST /api/session   → Groq (llama-3.3-70b-versatile): intent →
        │       structured JSON tracklist {title, artist, is_new, reason}
        │       + backfill candidates; then Spotify /v1/search
        │       (client-credentials) resolves each to a real track
        │       {id, name, artist, albumArt, spotifyUrl}; misses dropped,
        │       backfilled server-side
        ├── POST /api/recap     → Groq writes the recap line(s)
        ├── POST /api/save      → refresh-token → access token → add
        │       deduped tracks to owner's public "Flow Discoveries"
        │       playlist; returns playlist URL. Hidden if env missing.
        └── GET  /api/health    → reports which integrations are configured
```

**Env vars** (server-only, `.env.local`, mirrored in `.env.example`):
`GROQ_API_KEY`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REFRESH_TOKEN` (optional), `SPOTIFY_PLAYLIST_ID` (optional).

**Honest MVP proxies (documented in README):**
- "New to user" = LLM-marked `is_new` heuristic (no listening history exists — client-credentials, no login).
- Entry states B/C refer to playback *inside this app's player* (we can't see the visitor's real Spotify).
- Persistence = localStorage (a real product uses accounts).
- Learning loop = single-session novelty nudge only; multi-session learning is roadmap.

## Stack

- **Next.js 15 (App Router) + TypeScript + Tailwind CSS**, deployed on **Vercel**.
- **Zod** for validating LLM JSON output and localStorage reads.
- No database, no auth library, no state-management library (React context + a typed localStorage module suffice).
- Groq called via plain `fetch` to its OpenAI-compatible endpoint with `response_format: {type: "json_object"}` (no SDK needed).

## Planned repo structure

```
flow/
├── app/
│   ├── layout.tsx, globals.css        # dark theme tokens, reduced-motion
│   ├── page.tsx                       # Home: Flow button, context card, recap prompt
│   ├── setup/page.tsx                 # first-run one-screen preset setup
│   ├── session/page.tsx               # calm session view + sticky player
│   ├── recap/page.tsx                 # deferred discovery recap
│   ├── library/page.tsx               # preset management + Discoveries
│   ├── search/page.tsx                # search → "Start a Flow from this song"
│   └── api/
│       ├── session/route.ts
│       ├── recap/route.ts
│       ├── save/route.ts
│       └── health/route.ts
├── components/                        # TrackCard, StickyPlayer, FlowButton,
│                                      # RadialMenu, AdventureDial, NewBadge,
│                                      # BottomNav, RecapSheet, ...
├── lib/
│   ├── env.ts                         # single config module, server-only guard
│   ├── spotify/
│   │   ├── clientCredentials.ts       # cached app token
│   │   ├── search.ts                  # track:"..." artist:"..." resolver
│   │   └── playlist.ts                # refresh-token flow + dedupe + add
│   ├── groq/
│   │   ├── client.ts                  # fetch wrapper, JSON mode, 1 retry
│   │   └── prompts.ts                 # session + recap prompt builders
│   ├── session/generate.ts            # orchestration: intent → LLM → resolve
│   │                                  # → backfill → novelty placement rules
│   ├── storage.ts                     # typed localStorage (zod-validated)
│   └── types.ts                       # Preset, Track, Session, Discovery
├── scripts/get-refresh-token.mjs      # one-time owner OAuth helper (documented)
├── docs/BUILD_PLAN.md                 # this plan
├── .env.example  .gitignore  README.md
```

---

## Phases

### Phase 0 — Scaffold & hygiene (foundation)
- `create-next-app` (TS, Tailwind, App Router, ESLint) in a clean `flow/` repo; git init.
- `lib/env.ts`: one config module reading env vars; helper flags like `isSaveConfigured`.
- `.env.example` with all five vars + comments; `.gitignore` covering env files/builds.
- README skeleton (filled fully in Phase 6); `docs/BUILD_PLAN.md` (this document).
- Dark theme design tokens in Tailwind config/globals: near-black background (#121212 family), one green accent tuned to pass **AA on dark** (Spotify green #1DB954 fails AA for small text on black — use it for large elements/fills, a lighter green like #1ED760/#6EE7A0 for text), sans-serif stack, rounded cards, 390px centered mobile shell with `BottomNav` (Home / Search / Library — matching the screenshots).
- ✅ **Checkpoint:** repo runs locally, shell looks like a Spotify-dark mobile app, no secrets anywhere client-side.

### Phase 1 — Server integrations (the two engines)
- **Spotify client-credentials**: token fetch + in-memory cache with expiry (serverless-safe); `searchTrack(title, artist)` using scoped query `track:"<title>" artist:"<artist>"`, fallback retry with unscoped `"<title> <artist>"` before declaring a miss; returns `{id, name, artists, albumArt, spotifyUrl}`.
- **Groq wrapper**: JSON-mode chat call, zod-validated parse, one automatic retry on invalid JSON, timeout, friendly error mapping (never leak stack traces).
- `GET /api/health` to verify both integrations from the browser during dev.
- ✅ **Checkpoint:** a test route returns real resolved Spotify tracks for an LLM-generated list.

### Phase 2 — Session generation engine (the brain)
`lib/session/generate.ts` — pure server logic, testable before any UI:
- **Input**: preset (name, seed artists, energy, instrumental toggle, duration, adventure dial), entry state (A/B/C + optional anchor track), novelty nudge from past skips.
- **Track count** = duration ÷ 3.5 min.
- **One LLM call** returns the main tracklist **plus ~30% extra backfill candidates** in the same response (avoids a second round trip when Search misses).
- **Prompt encodes the product rules**: consistency first (steady energy/tempo/type, no jarring transitions), instrumental toggle secondary to consistency, novelty fraction from adventure dial, `is_new` tracks sonically close to seeds, cold-start ramp (few seeds → open safe/popular, novelty later and gentler), State B/C easing (anchor song is a taste hint for the first 1–2 tracks, then preset consistency wins), very short session → near-zero novelty.
- **Post-processing in code (don't trust the LLM for placement)**: resolve every track via Search, drop misses, backfill; enforce non-adjacent placement of `is_new` tracks by reordering; enforce the exact novelty count; dedupe.
- Per-track one-line `reason` (from the same LLM call) + `POST /api/recap` for the recap copy.
- ✅ **Checkpoint:** `POST /api/session` returns a real, consistent, correctly-dosed session as JSON (inspect several presets/dials before building UI).

### Phase 3 — Core UI loop ⭐ MUST-HAVE (setup → session → recap)
- **Setup** (`/setup`): one screen — pick preset type (Study/Work/Code/Read), add 2–3 artists, smart defaults shown (energy, instrumental, length, adventure defaulting LOW). Saves to localStorage; routes to session.
- **Session view** (`/session`): calm and minimal. Track list of lightweight cards (album art, title, artist, Open-in-Spotify link, "✦ New" badge = icon + text, never color alone). Quiet transparency line ("2 new tracks added this session"). Adventure dial + "less adventurous today" reachable but unobtrusive. No mid-session popups.
- **Sticky player**: single Spotify IFrame-API embed docked above the bottom nav (mini-player pattern from the screenshots). Tap a card → `loadUri()`. `playback_update` events drive: now-playing highlight, **auto-advance** at track end, and **skip detection** (next pressed / new track loaded with >30s remaining). Skip on a `is_new` track → silently nudge preset novelty down (localStorage). Graceful fallback: if the IFrame API script fails to load, render a plain per-track embed on tap.
- **Recap** (`/recap`): "Last Coding Flow: 4 new songs slipped in. Keep any?" — per-track card with reason, Save / Open in Spotify, plus Save all. Discoveries always persisted to the preset's Discoveries list regardless of dismissal.
- **Recap trigger, both paths**: (a) real deferred path — session state persists in localStorage; on next app open with an unfinished session, Home shows a dismissible recap prompt; (b) demo path — "End session and see discoveries" button in the session view.
- **Accessibility throughout**: AA contrast, aria-labels, keyboard operability, visible focus, ≥44px targets, `prefers-reduced-motion` + in-app Reduce-motion toggle, minimal animation by default.
- ✅ **Checkpoint (MVP-valid gate):** in a fresh incognito window, a visitor completes setup → hears tracks in the browser with **no login** → sees the recap.

### Phase 4 — Shared-playlist Save (no visitor login)
- `scripts/get-refresh-token.mjs`: spins up a localhost:8080 listener, opens the authorize URL (`playlist-modify-public`, redirect `http://127.0.0.1:8080`), exchanges the code, prints the refresh token + can create the "Flow Discoveries" playlist and print its id. README documents the one-time run.
- `POST /api/save`: refresh token → access token; fetch current playlist track ids → **dedupe** → add items; return the public playlist URL for the "Open the playlist" link.
- **Graceful degradation**: `/api/health`-style env check; if `SPOTIFY_REFRESH_TOKEN`/`SPOTIFY_PLAYLIST_ID` missing, Save UI is hidden (Open-in-Spotify remains) and nothing crashes.
- ✅ **Checkpoint:** "Save all" in recap → tracks appear in the real public playlist, no duplicates on repeat saves.

### Phase 5 — Flow button, presets, entry states
- **Flow button (Home, primary)**: quick tap = start most-recent preset. Hold (~350ms, pointer events) = radial menu of favourited presets around the button, drag toward one to start; while a Flow is running, hold shows an OFF target at the bottom, drag to stop. **Accessible fallback ships first**: the same hold/long-press (or Enter/Space) also opens a plain tappable preset list; radial is progressive enhancement for pointer users, never the only path.
- **Home card** when nothing is playing: context-aware "Start your Coding Flow?".
- **Library** (`/library`): per-preset card with Play button, favourite toggle (feeds the radial), Discoveries list (every new track Flow ever introduced, with Save/Open actions), and "Feed it more" (add artists/songs to the preset's taste).
- **Search** (`/search`): search via existing server route → results with "Start a Flow from this song" (State C: pick target preset, song becomes strong anchor) and "Add to a Flow preset".
- **Entry states wired end-to-end**: A = fresh start from preset taste; B = something already playing in our player → current track finishes, generation eases over 1–2 tracks; C = chosen song as anchor.
- ✅ **Checkpoint:** tap/hold/drag all work on mobile; keyboard-only user can do everything.

### Phase 6 — Edge cases, deploy, final tidy
- Edge cases: new user with no taste (defaults + gentle prompt), all Search misses (backfill, then friendly "couldn't build this session" retry state), user skips everything (novelty → 0, lean familiar), very short sessions (no novelty), API timeout/error (friendly message, never a stack trace), empty localStorage / corrupted state (zod-validated reads fall back to defaults).
- Deploy to Vercel with env vars set; verify live URL in fresh incognito: tracks play via embed, Save updates the real playlist.
- Full README: what it is, the LLM+Search hybrid and why (no Spotify recommender / audio-features — deprecated for new apps), local run + deploy instructions, env var table, one-time token setup, **Roadmap & Limitations** (real learning loop, in-app full playback, 5-user OAuth cap, localStorage vs accounts, `is_new` heuristic honesty).
- Tidy pass: no dead files, no console spam, small named modules, consistent naming.
- ✅ **Checkpoint:** live URL + public repo are grader-ready.

---

## Key implementation details worth pinning

- **Secrets discipline**: only `lib/env.ts` reads `process.env`; it's imported solely by server code (API routes / lib server modules). Nothing secret is ever in a client component or `NEXT_PUBLIC_`.
- **LLM output contract** (zod): `{ tracks: [{title, artist, is_new, reason}], backfill: [{title, artist, is_new, reason}] }` — free-form text is rejected and retried once.
- **Novelty placement is code, not prompt**: the exact new-track count and non-adjacency are enforced by post-processing, so the dial is always honest.
- **Spotify token cache**: module-scope `{token, expiresAt}`; refetch when <60s remaining (fine on Vercel serverless — worst case an extra token call per cold lambda).
- **Search resolution**: scoped query first, loose query fallback, then drop + backfill. Keep `images[0]` and `external_urls.spotify`.
- **localStorage schema versioned** (`flow:v1:*` keys) so future changes don't crash old visitors.

## Verification (end-to-end)

1. `npm run dev` → `/api/health` shows Groq + Spotify configured.
2. `curl POST /api/session` with a Code preset → JSON has correct track count, exact novelty count, non-adjacent `is_new`, all tracks with real Spotify ids/art/urls.
3. Browser (mobile viewport 390px): setup → session → press play → audio plays with no login; tap next on a New track → novelty nudge stored; End session → recap; reopen app → re-entry recap prompt appears.
4. Save all → open the public "Flow Discoveries" playlist URL → tracks present; Save all again → no duplicates.
5. Remove `SPOTIFY_REFRESH_TOKEN` locally → app still runs, Save hidden.
6. Keyboard-only walkthrough + Lighthouse accessibility pass (contrast, labels, targets).
7. After deploy: full incognito run on the live URL from a phone.

## Build sequence & confirmation gates

Per the spec, I'll pause for your confirmation at each phase checkpoint (0→6) before continuing. Phase 3's checkpoint is the MVP-validity gate; Phases 4–5 are the second priority tier; the radial drag gesture is explicitly the last thing inside Phase 5 so it can never block the core loop.
