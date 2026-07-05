# Edge-case checklist (tested at the end of each phase)

Automated cases live in `tests/` (`npm test`, mocked network — no keys or quota
needed). Live/manual cases are verified against real APIs and in the browser at each
phase checkpoint. ✅ = verified, ⬜ = pending its phase.

## Phase 1 — Server integrations

| Case | How | Status |
| --- | --- | --- |
| Spotify token is cached; no refetch per request | `tests/spotify.test.ts` | ✅ |
| Token near expiry → refetched, not reused | `tests/spotify.test.ts` | ✅ |
| Missing Spotify credentials → 503, no network call | `tests/spotify.test.ts` | ✅ |
| Spotify auth/HTTP/network failure → friendly message, no stack | `tests/spotify.test.ts` | ✅ |
| Search: scoped hit maps id/name/artist/art/url | `tests/spotify.test.ts` | ✅ |
| Search: scoped miss → loose-query fallback | `tests/spotify.test.ts` | ✅ |
| Search: both queries miss → `null` (drop + backfill) | `tests/spotify.test.ts` | ✅ |
| Quotes in title/artist don't break field filters | `tests/spotify.test.ts` | ✅ |
| Multi-artist join; missing album art → `null` art | `tests/spotify.test.ts` | ✅ |
| Groq: valid structured JSON parsed on first try | `tests/groq.test.ts` | ✅ |
| Groq: free-form/invalid JSON → one retry with feedback | `tests/groq.test.ts` | ✅ |
| Groq: valid JSON, wrong shape → retry via zod error | `tests/groq.test.ts` | ✅ |
| Groq: two bad attempts → friendly error, never raw text | `tests/groq.test.ts` | ✅ |
| Groq: missing key → 503 before any network call | `tests/groq.test.ts` | ✅ |
| Groq: rate limit / timeout → friendly error | `tests/groq.test.ts` | ✅ |
| Live: `/api/health?live=1` proves real keys work | manual (needs `.env.local`) | ⬜ |

## Phase 2 — Session generation (planned)

- Track count sized to duration (short session → fewer tracks, near-zero novelty)
- Adventure dial 0 → zero `is_new`; high dial capped at a sane fraction
- `is_new` tracks never adjacent after post-processing
- Search misses → backfill used; too many misses → still returns a coherent session
- All backfills miss → friendly "couldn't build this session" error
- Duplicate tracks from LLM → deduped
- Cold start (0–1 seed artists) → safe/popular opening, gentler novelty
- Anchor track (states B/C) present → session eases from it in 1–2 tracks
- Novelty nudge from skips lowers the new-track fraction

## Phase 3 — Core UI loop (planned)

- Empty/corrupted localStorage → defaults, no crash (zod-validated reads)
- Setup with no artists entered → preset defaults + gentle prompt
- IFrame API script fails to load → per-track embed fallback still plays
- Session fetch fails → friendly retry state, never a blank screen
- Recap with zero new tracks → calm "nothing new this time" state
- Refresh mid-session → session restored; unfinished session → re-entry recap prompt
- Keyboard-only pass + reduced-motion honored

## Phase 4 — Save (planned)

- `SPOTIFY_REFRESH_TOKEN`/`SPOTIFY_PLAYLIST_ID` missing → Save hidden, app fine
- Save all twice → no duplicate tracks in the playlist
- Expired/revoked refresh token → friendly error, core loop unaffected
- Empty selection save → no-op, no API call

## Phase 5 — Flow button & presets (planned)

- Quick tap with no presets yet → routes to setup instead of failing
- Hold + release outside any radial target → cancels, nothing starts
- No favourited presets → radial falls back to the preset list
- Deleting the most-recent preset → next-most-recent becomes the tap default
- Search: empty query / no results → calm empty state
- Keyboard/screen-reader path can start and stop every Flow

## Phase 6 — Deploy sweep (planned)

- Fresh incognito on the live URL: full loop with no login
- Env vars removed one at a time → graceful degradation each time
- Lighthouse accessibility pass ≥ 95; AA contrast spot checks
