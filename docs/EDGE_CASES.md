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
| Live: `/api/health?live=1` proves real keys work | verified 2026-07-06 | ✅ |

## Phase 2 — Session generation

| Case | How | Status |
| --- | --- | --- |
| Track count sized to duration; minimum 3 | `tests/session-rules.test.ts` | ✅ |
| Adventure 0 → zero new tracks | `tests/session-rules.test.ts`, `tests/generate.test.ts` | ✅ |
| Very short session (≤4 tracks) → no novelty; <8 tracks → max 1 | `tests/session-rules.test.ts` | ✅ |
| High dial capped by non-adjacent placement limit | `tests/session-rules.test.ts` | ✅ |
| Skip nudge lowers dose; cold start (<2 seeds) one level gentler | `tests/session-rules.test.ts` | ✅ |
| New tracks never in first two slots, never adjacent | `tests/session-rules.test.ts`, `tests/generate.test.ts` | ✅ |
| Spacing loses/duplicates nothing | `tests/session-rules.test.ts` | ✅ |
| Search misses → dropped + backfilled from LLM alternates | `tests/generate.test.ts` | ✅ |
| Per-track search failure = miss, not crash | `tests/generate.test.ts` | ✅ |
| Almost nothing resolves → friendly "couldn't build" error | `tests/generate.test.ts` | ✅ |
| LLM duplicate tracks → deduped (name + resolved id) | `tests/generate.test.ts` | ✅ |
| LLM over-marks `is_new` → trimmed to exact target via familiar spares | `tests/generate.test.ts` | ✅ |
| Entry state B/C anchor reaches the prompt (ease vs strong anchor) | `tests/generate.test.ts` | ✅ |
| Recap LLM failure → template fallback, never blocks | `app/api/recap/route.ts` (fallback path) | ✅ |
| Live: real session is consistent + resolvable (warm, cold-start, short) | verified 2026-07-06 | ✅ |
| Wrong-artist search match (e.g. metal in a mellow session) → rejected | `tests/spotify.test.ts` (artist guard) | ✅ |

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
