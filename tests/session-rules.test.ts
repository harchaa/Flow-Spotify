import { describe, expect, it } from "vitest";
import {
  dedupeByTitleArtist,
  maxNewFor,
  noveltyCountFor,
  spaceOutNewTracks,
  trackCountFor,
} from "@/lib/session/rules";
import type { SessionTrack } from "@/lib/types";

const track = (id: string, isNew = false): SessionTrack => ({
  id,
  name: id,
  artist: "Artist",
  albumArt: null,
  spotifyUrl: `https://open.spotify.com/track/${id}`,
  isNew,
  reason: "fits",
});

describe("trackCountFor (~3.5 min per track)", () => {
  it("sizes the tracklist to the session duration", () => {
    expect(trackCountFor(60)).toBe(17);
    expect(trackCountFor(25)).toBe(7);
  });

  it("never returns fewer than 3 tracks, even for tiny sessions", () => {
    expect(trackCountFor(5)).toBe(3);
    expect(trackCountFor(10)).toBe(3);
  });
});

describe("noveltyCountFor (adventure dosing)", () => {
  const base = { trackCount: 17, adventure: 1, noveltyNudge: 0, seedCount: 3 };

  it("adventure 0 → zero new tracks", () => {
    expect(noveltyCountFor({ ...base, adventure: 0 })).toBe(0);
  });

  it("scales with the dial but stays a small fraction", () => {
    const low = noveltyCountFor(base);
    const high = noveltyCountFor({ ...base, adventure: 3 });
    expect(low).toBeGreaterThanOrEqual(1);
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThanOrEqual(maxNewFor(17));
  });

  it("very short session → no novelty (no runway)", () => {
    expect(noveltyCountFor({ ...base, trackCount: 3, adventure: 3 })).toBe(0);
    expect(noveltyCountFor({ ...base, trackCount: 4, adventure: 3 })).toBe(0);
  });

  it("short-ish session → at most one new track", () => {
    expect(
      noveltyCountFor({ ...base, trackCount: 7, adventure: 3 }),
    ).toBeLessThanOrEqual(1);
  });

  it("skip-learning nudge lowers the dose", () => {
    const nudged = noveltyCountFor({ ...base, adventure: 2, noveltyNudge: -2 });
    expect(nudged).toBe(0);
  });

  it("cold start (zero seeds) is one level gentler; one seed is full signal", () => {
    const warm = noveltyCountFor({ ...base, adventure: 2 });
    const cold = noveltyCountFor({ ...base, adventure: 2, seedCount: 0 });
    const oneSeed = noveltyCountFor({ ...base, adventure: 2, seedCount: 1 });
    expect(cold).toBeLessThan(warm);
    expect(oneSeed).toBe(warm);
  });

  it("never exceeds what non-adjacent placement allows", () => {
    for (let n = 5; n <= 30; n++) {
      expect(
        noveltyCountFor({ trackCount: n, adventure: 3, noveltyNudge: 0, seedCount: 3 }),
      ).toBeLessThanOrEqual(maxNewFor(n));
    }
  });
});

describe("spaceOutNewTracks (quiet placement)", () => {
  it("keeps the first two tracks familiar and no two new tracks adjacent", () => {
    const tracks = [
      track("n1", true),
      track("n2", true),
      track("f1"),
      track("f2"),
      track("f3"),
      track("f4"),
      track("f5"),
      track("f6"),
    ];
    const ordered = spaceOutNewTracks(tracks);

    expect(ordered).toHaveLength(8);
    expect(ordered[0].isNew).toBe(false);
    expect(ordered[1].isNew).toBe(false);
    for (let i = 1; i < ordered.length; i++) {
      expect(ordered[i - 1].isNew && ordered[i].isNew).toBe(false);
    }
  });

  it("preserves every track (nothing lost or duplicated)", () => {
    const tracks = [track("f1"), track("n1", true), track("f2"), track("n2", true), track("f3"), track("f4")];
    const ordered = spaceOutNewTracks(tracks);
    expect(new Set(ordered.map((t) => t.id)).size).toBe(6);
  });

  it("leaves an all-familiar session untouched", () => {
    const tracks = [track("f1"), track("f2"), track("f3")];
    expect(spaceOutNewTracks(tracks)).toEqual(tracks);
  });
});

describe("dedupeByTitleArtist", () => {
  it("drops case/whitespace-insensitive duplicates, keeping the first", () => {
    const list = [
      { title: "Intro", artist: "The xx", is_new: false },
      { title: "intro ", artist: "the XX", is_new: true },
      { title: "Intro", artist: "Alt-J", is_new: false },
    ];
    const deduped = dedupeByTitleArtist(list);
    expect(deduped).toHaveLength(2);
    expect(deduped[0].is_new).toBe(false);
  });
});
