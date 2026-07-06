import type { SessionTrack } from "@/lib/types";

/** ~3.5 min per track; never fewer than 3 tracks. */
export function trackCountFor(minutes: number): number {
  return Math.max(3, Math.round(minutes / 3.5));
}

/**
 * Most new tracks that can be placed with no two adjacent and none in the
 * first two slots (the session must open familiar).
 */
export function maxNewFor(trackCount: number): number {
  return Math.max(0, Math.floor((trackCount - 2) / 2));
}

/** Fraction of the session that may be new, per adventure level 0–3. */
const NOVELTY_FRACTION = [0, 0.12, 0.2, 0.28] as const;

/**
 * How many new tracks to dose. Applies the skip-learning nudge, the
 * cold-start rule (NO seeds → one level gentler; a single named artist is
 * already a solid taste signal), the very-short-session rule (little/no
 * runway → little/no novelty), and the placement cap.
 */
export function noveltyCountFor(opts: {
  trackCount: number;
  adventure: number;
  noveltyNudge: number;
  seedCount: number;
}): number {
  const { trackCount, adventure, noveltyNudge, seedCount } = opts;
  if (trackCount <= 4) return 0;

  const coldStartPenalty = seedCount === 0 ? 1 : 0;
  const level = Math.min(
    3,
    Math.max(0, Math.round(adventure + noveltyNudge - coldStartPenalty)),
  );
  let count = Math.round(trackCount * NOVELTY_FRACTION[level]);
  if (trackCount < 8) count = Math.min(count, 1);
  return Math.min(count, maxNewFor(trackCount));
}

/** Dedupe by normalized "title|artist" (pre-resolution). */
export function dedupeByTitleArtist<T extends { title: string; artist: string }>(
  tracks: T[],
): T[] {
  const seen = new Set<string>();
  return tracks.filter((t) => {
    const key = `${t.title.trim().toLowerCase()}|${t.artist.trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Reorder so the session opens with two familiar tracks and no two new
 * tracks are adjacent, spreading novelty evenly across the session.
 * Relative order within familiar and new groups is preserved.
 */
export function spaceOutNewTracks(tracks: SessionTrack[]): SessionTrack[] {
  const familiar = tracks.filter((t) => !t.isNew);
  const fresh = tracks.filter((t) => t.isNew);
  if (fresh.length === 0 || familiar.length === 0) return tracks;

  const total = tracks.length;
  const step = Math.max(2, Math.floor(total / (fresh.length + 1)));
  const result = [...familiar];
  let pos = Math.max(2, step);
  let lastInserted = -2;

  for (const track of fresh) {
    if (pos <= lastInserted + 1) pos = lastInserted + 2; // keep non-adjacent
    pos = Math.min(pos, result.length);
    result.splice(pos, 0, track);
    lastInserted = pos;
    pos += step;
  }
  return result;
}
