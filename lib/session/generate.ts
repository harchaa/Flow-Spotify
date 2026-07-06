import { ApiError, FRIENDLY } from "@/lib/errors";
import { groqJson } from "@/lib/groq/client";
import { buildSessionMessages } from "@/lib/groq/prompts";
import { searchTrack } from "@/lib/spotify/search";
import {
  LlmSessionSchema,
  type EntryState,
  type GeneratedSession,
  type LlmTrack,
  type Preset,
  type SessionTrack,
} from "@/lib/types";
import {
  dedupeByTitleArtist,
  noveltyCountFor,
  spaceOutNewTracks,
  trackCountFor,
} from "@/lib/session/rules";

/**
 * A Spotify miss (or transient per-track failure) is a drop, never a crash.
 * Exception: a 429 rate limit is global, so it propagates — retrying the
 * remaining tracks would only deepen the block.
 */
async function resolveOrNull(candidate: LlmTrack): Promise<SessionTrack | null> {
  try {
    const resolved = await searchTrack(candidate.title, candidate.artist);
    if (!resolved) return null;
    return { ...resolved, isNew: candidate.is_new, reason: candidate.reason };
  } catch (err) {
    if (err instanceof ApiError && err.status === 429) throw err;
    return null;
  }
}

/** Resolve in small batches — dev-mode Spotify apps have tight burst limits. */
async function resolveBatched(candidates: LlmTrack[]): Promise<(SessionTrack | null)[]> {
  const BATCH = 5;
  const results: (SessionTrack | null)[] = [];
  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH);
    results.push(...(await Promise.all(batch.map(resolveOrNull))));
  }
  return results;
}

/**
 * The core loop: one LLM call (tracklist + backfill alternates), resolve
 * everything against real Spotify tracks, drop misses, backfill, then
 * enforce the novelty dose and non-adjacent placement in code.
 */
export async function generateSession(
  preset: Preset,
  entry: EntryState,
): Promise<GeneratedSession> {
  const trackCount = trackCountFor(preset.sessionLength);
  const targetNew = noveltyCountFor({
    trackCount,
    adventure: preset.adventure,
    noveltyNudge: preset.noveltyNudge,
    seedCount: preset.seedArtists.filter(Boolean).length,
  });

  const llm = await groqJson(
    LlmSessionSchema,
    buildSessionMessages(preset, entry, trackCount, targetNew),
  );

  const candidates = dedupeByTitleArtist([...llm.tracks, ...llm.backfill]);
  const main = candidates.slice(0, trackCount);
  const spare = candidates.slice(trackCount);

  // Resolve the main list (throttled); walk spares only as needed.
  const resolvedMain = await resolveBatched(main);

  const tracks: SessionTrack[] = [];
  const seenIds = new Set<string>();
  const add = (t: SessionTrack | null) => {
    if (t && !seenIds.has(t.id)) {
      seenIds.add(t.id);
      tracks.push(t);
    }
  };
  resolvedMain.forEach(add);

  const spareQueue = [...spare];
  const nextSpare = async (wantNew: boolean | null): Promise<SessionTrack | null> => {
    while (spareQueue.length > 0) {
      const idx =
        wantNew === null
          ? 0
          : spareQueue.findIndex((c) => c.is_new === wantNew);
      if (idx === -1) return null;
      const [candidate] = spareQueue.splice(idx, 1);
      const resolved = await resolveOrNull(candidate);
      if (resolved && !seenIds.has(resolved.id)) return resolved;
    }
    return null;
  };

  // Backfill up to the target length.
  while (tracks.length < trackCount) {
    const filler = await nextSpare(null);
    if (!filler) break;
    add(filler);
  }

  // Enforce the novelty dose: swap excess discoveries for familiar spares
  // (or drop them), and never exceed what non-adjacent placement allows.
  const newTracks = tracks.filter((t) => t.isNew);
  while (newTracks.length > targetNew) {
    const excess = newTracks.pop()!;
    const index = tracks.indexOf(excess);
    const replacement = await nextSpare(false);
    if (replacement) {
      seenIds.add(replacement.id);
      tracks.splice(index, 1, replacement);
    } else {
      tracks.splice(index, 1);
    }
  }

  // Too few discoveries (they didn't resolve)? Swap familiar tracks for new
  // spares so the adventure dial's promise is honored both ways.
  let deficit = targetNew - tracks.filter((t) => t.isNew).length;
  while (deficit > 0) {
    const replacement = await nextSpare(true);
    if (!replacement) break;
    const index = tracks.findLastIndex((t) => !t.isNew);
    if (index === -1) break;
    seenIds.add(replacement.id);
    tracks.splice(index, 1, replacement);
    deficit--;
  }

  if (tracks.length < 3) {
    throw new ApiError(FRIENDLY.sessionFailed);
  }

  const ordered = spaceOutNewTracks(tracks);
  return {
    tracks: ordered,
    newCount: ordered.filter((t) => t.isNew).length,
  };
}
