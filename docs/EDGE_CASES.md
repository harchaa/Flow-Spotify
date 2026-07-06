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

## Phase 3 — Core UI loop

Live cases ran in headless Chrome against the dev server with real keys
(15/15, run twice for LLM variance).

| Case | How | Status |
| --- | --- | --- |
| Empty/corrupted localStorage → defaults, no crash | `tests/storage.test.ts` + live browser | ✅ |
| Wrong-shape (stale-version) stored JSON → defaults | `tests/storage.test.ts` | ✅ |
| Novelty nudge clamped to [-2, 0]; unknown preset ignored | `tests/storage.test.ts` | ✅ |
| Discoveries deduped across sessions, kept per preset | `tests/storage.test.ts` | ✅ |
| Recent preset falls back to newest if marked one deleted | `tests/storage.test.ts` | ✅ |
| Setup with no artists → gentle prompt, cold-start defaults | UI copy + Phase 2 cold-start rules | ✅ |
| Full loop live: setup → real session → embed player → recap | headless Chrome e2e | ✅ |
| New badge is text+icon (visible with zero color perception) | e2e text assertion | ✅ |
| Refresh mid-session → same session restored, no regeneration | headless Chrome e2e | ✅ |
| Leave without ending → re-entry recap prompt on Home | headless Chrome e2e | ✅ |
| Recap seen → prompt cleared; discoveries persist in Library data | headless Chrome e2e + `tests/storage.test.ts` | ✅ |
| IFrame API script blocked → plain-embed fallback player | headless Chrome e2e (request interception) | ✅ |
| Marked discoveries fail to resolve → topped up from new spares | `tests/generate.test.ts` + live fix | ✅ |
| Session fetch fails → friendly retry state | `app/session/page.tsx` error view (manual) | ✅ |
| Recap with zero new tracks → calm all-familiar state | recap page branch + template fallback | ✅ |
| Keyboard-only pass + Lighthouse a11y | deferred to Phase 6 deploy sweep | ⬜ |

## Phase 4 — Save

| Case | How | Status |
| --- | --- | --- |
| Token env missing → `/api/save` 503 friendly; recap hides Save | `tests/playlist.test.ts` + live curl | ✅ |
| Save dedupes against tracks already in the playlist | `tests/playlist.test.ts` | ✅ |
| Save all twice → second save adds nothing | `tests/playlist.test.ts` | ✅ |
| Large playlist → pagination walked before dedupe | `tests/playlist.test.ts` | ✅ |
| Empty selection → no-op, zero network calls | `tests/playlist.test.ts` | ✅ |
| Expired/revoked refresh token → friendly error, core loop fine | `tests/playlist.test.ts` | ✅ |
| Network failure mid-add → friendly error | `tests/playlist.test.ts` | ✅ |
| Live: Save adds to the real playlist; repeat save dedupes | verified 2026-07-06 via /api/save | ✅ |
| Spotify Feb-2026 endpoint migration (legacy /tracks + /users/{id}/playlists → 403) | fixed: /items + /me/playlists, probed live | ✅ |

## Phase 5 — Flow button, presets, entry states

Live cases ran in headless Chrome against real APIs (16/16).

| Case | How | Status |
| --- | --- | --- |
| Quick tap with no presets → routes to setup, never fails | headless Chrome e2e | ✅ |
| Hold (350ms) opens radial of favourites; drag starts that preset | headless Chrome e2e | ✅ |
| Hold + release outside every target → cancels, nothing starts | headless Chrome e2e + `tests/radial.test.ts` | ✅ |
| Radial targets spaced ≥50px apart; OFF never collides with presets | `tests/radial.test.ts` | ✅ |
| Running Flow: hold shows OFF; drag to OFF ends silently (recap deferred) | headless Chrome e2e | ✅ |
| List fallback (keyboard/screen reader) starts and stops every Flow | headless Chrome e2e | ✅ |
| Entry state A: fresh start from preset taste | e2e payload assertion | ✅ |
| Entry state B: track was playing → its title/artist sent as taste hint | e2e payload assertion | ✅ |
| Entry state C: chosen song sent as strong anchor | e2e payload assertion | ✅ |
| State C bypasses session restore (explicit intent wins) | fixed + e2e | ✅ |
| Library: favourite toggle, feed-more, per-preset Discoveries | headless Chrome e2e | ✅ |
| Deleting the recent preset → newest becomes tap default | `tests/storage.test.ts` | ✅ |
| Search: real results; zero results → calm empty state | headless Chrome e2e (mocked zero-result) | ✅ |

## Phase 6 — Deploy sweep

| Case | How | Status |
| --- | --- | --- |
| Lighthouse accessibility on all four screens | local audit — Home/Setup/Library/Search all **100** | ✅ |
| No console spam, no dead files, no secrets in the repo | grep + tidy pass | ✅ |
| Save env missing → Save hidden, `/api/save` 503 friendly | live curl (Phase 4) | ✅ |
| Fresh incognito on the live URL: full loop with no login | after deploy | ⬜ |
| Live Save all → real playlist updates | verified locally; re-check on live URL | ⬜ |

## Post-feedback changes (endless sessions + Now Playing)

| Case | How | Status |
| --- | --- | --- |
| Setup no longer offers a session length; sessions are endless | headless Chrome check | ✅ |
| Nearing the queue end → next batch auto-appends (eased, deduped, excluded) | headless Chrome e2e (7 → 14 tracks) | ✅ |
| Extension failure/rate limit → silent retry on next advance, never crashes | `maybeExtend` catch path | ✅ |
| Tap a track → plays immediately + full-screen Now Playing (art, prev/next) | headless Chrome e2e | ✅ |
| Overlay close returns to list; Esc works; player stays mounted (audio uninterrupted) | headless Chrome e2e | ✅ |
| Single seed artist → similar-artist blend, not one-artist loop (≤⅓ per artist, code-enforced) | prompt + variety guard, live-verified | ✅ |
| Single seed no longer triggers the cold-start novelty penalty (0 seeds only) | `tests/session-rules.test.ts` + live | ✅ |
