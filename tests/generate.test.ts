import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LlmSession, LlmTrack, Preset } from "@/lib/types";

vi.mock("@/lib/groq/client", () => ({ groqJson: vi.fn() }));
vi.mock("@/lib/spotify/search", () => ({ searchTrack: vi.fn() }));

import { groqJson } from "@/lib/groq/client";
import { searchTrack } from "@/lib/spotify/search";
import { generateSession } from "@/lib/session/generate";
import { ApiError, FRIENDLY } from "@/lib/errors";

const groqMock = vi.mocked(groqJson);
const searchMock = vi.mocked(searchTrack);

const llmTrack = (title: string, isNew = false): LlmTrack => ({
  title,
  artist: `${title} Artist`,
  is_new: isNew,
  reason: "steady mellow pulse",
});

/** 35-min preset → 10 tracks; adventure 2 with 3 seeds → 2 new. */
const preset: Preset = {
  id: "p1",
  kind: "Code",
  name: "Coding Flow",
  seedArtists: ["Tycho", "Bonobo", "Four Tet"],
  energy: 2,
  instrumentalOnly: true,
  sessionLength: 35,
  adventure: 2,
  favourite: true,
  noveltyNudge: 0,
  createdAt: 0,
};

const llmSession = (tracks: LlmTrack[], backfill: LlmTrack[] = []): LlmSession => ({
  tracks,
  backfill,
});

function tenTracks(newTitles: string[] = ["New1", "New2"]): LlmTrack[] {
  const familiar = Array.from({ length: 10 - newTitles.length }, (_, i) =>
    llmTrack(`Familiar${i + 1}`),
  );
  return [...familiar, ...newTitles.map((t) => llmTrack(t, true))];
}

/** Default: every search resolves to a unique real track. */
function resolveAll() {
  searchMock.mockImplementation(async (title) => ({
    id: `id-${title}`,
    name: title,
    artist: `${title} Artist`,
    albumArt: "https://img/a.jpg",
    spotifyUrl: `https://open.spotify.com/track/${title}`,
  }));
}

beforeEach(() => {
  groqMock.mockReset();
  searchMock.mockReset();
});

describe("generateSession", () => {
  it("returns a full session with the exact novelty dose, spaced out", async () => {
    groqMock.mockResolvedValueOnce(llmSession(tenTracks()));
    resolveAll();

    const session = await generateSession(preset, { state: "A" });

    expect(session.tracks).toHaveLength(10);
    expect(session.newCount).toBe(2);
    expect(session.tracks[0].isNew).toBe(false);
    expect(session.tracks[1].isNew).toBe(false);
    for (let i = 1; i < session.tracks.length; i++) {
      expect(session.tracks[i - 1].isNew && session.tracks[i].isNew).toBe(false);
    }
    // every track is a real resolved Spotify track
    for (const t of session.tracks) {
      expect(t.id).toMatch(/^id-/);
      expect(t.spotifyUrl).toContain("open.spotify.com");
    }
  });

  it("drops Spotify misses and backfills from the alternates", async () => {
    groqMock.mockResolvedValueOnce(
      llmSession(tenTracks(), [llmTrack("Spare1"), llmTrack("Spare2")]),
    );
    resolveAll();
    searchMock.mockImplementation(async (title) =>
      title === "Familiar1" || title === "Familiar2"
        ? null
        : {
            id: `id-${title}`,
            name: title,
            artist: `${title} Artist`,
            albumArt: null,
            spotifyUrl: `https://open.spotify.com/track/${title}`,
          },
    );

    const session = await generateSession(preset, { state: "A" });

    expect(session.tracks).toHaveLength(10);
    const names = session.tracks.map((t) => t.name);
    expect(names).toContain("Spare1");
    expect(names).toContain("Spare2");
    expect(names).not.toContain("Familiar1");
  });

  it("throws a friendly error when almost nothing resolves", async () => {
    groqMock.mockResolvedValueOnce(llmSession(tenTracks(), [llmTrack("Spare1")]));
    searchMock.mockResolvedValue(null);

    await expect(generateSession(preset, { state: "A" })).rejects.toThrow(
      FRIENDLY.sessionFailed,
    );
  });

  it("propagates a Spotify rate limit instead of burning quota on retries", async () => {
    groqMock.mockResolvedValueOnce(llmSession(tenTracks()));
    searchMock.mockRejectedValue(new ApiError(FRIENDLY.spotifyBusy, 429));

    await expect(generateSession(preset, { state: "A" })).rejects.toThrow(
      FRIENDLY.spotifyBusy,
    );
  });

  it("treats per-track search failures as misses, not crashes", async () => {
    groqMock.mockResolvedValueOnce(llmSession(tenTracks(), [llmTrack("Spare1")]));
    resolveAll();
    searchMock.mockImplementationOnce(async () => {
      throw new Error("network blip");
    });

    const session = await generateSession(preset, { state: "A" });
    expect(session.tracks.length).toBeGreaterThanOrEqual(9);
  });

  it("dedupes duplicate tracks from the LLM (by name and by resolved id)", async () => {
    const dupes = [...tenTracks(), llmTrack("Familiar1"), llmTrack("familiar1 ")];
    groqMock.mockResolvedValueOnce(llmSession(dupes));
    resolveAll();

    const session = await generateSession(preset, { state: "A" });
    const ids = session.tracks.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("trims excess LLM-marked discoveries down to the target dose", async () => {
    // LLM disobeys and marks 5 of 10 as new; target for this preset is 2
    groqMock.mockResolvedValueOnce(
      llmSession(tenTracks(["New1", "New2", "New3", "New4", "New5"]), [
        llmTrack("SpareFam1"),
        llmTrack("SpareFam2"),
        llmTrack("SpareFam3"),
      ]),
    );
    resolveAll();

    const session = await generateSession(preset, { state: "A" });
    expect(session.newCount).toBe(2);
    expect(session.tracks).toHaveLength(10);
  });

  it("tops up from new spares when marked discoveries fail to resolve", async () => {
    // Both LLM-marked discoveries miss on Spotify; new spares exist.
    groqMock.mockResolvedValueOnce(
      llmSession(tenTracks(), [
        llmTrack("SpareNew1", true),
        llmTrack("SpareNew2", true),
        llmTrack("SpareFam1"),
      ]),
    );
    resolveAll();
    searchMock.mockImplementation(async (title) =>
      title === "New1" || title === "New2"
        ? null
        : {
            id: `id-${title}`,
            name: title,
            artist: `${title} Artist`,
            albumArt: null,
            spotifyUrl: `https://open.spotify.com/track/${title}`,
          },
    );

    const session = await generateSession(preset, { state: "A" });
    expect(session.newCount).toBe(2);
    const names = session.tracks.filter((t) => t.isNew).map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["SpareNew1", "SpareNew2"]));
  });

  it("adventure 0 → a session with zero discoveries", async () => {
    groqMock.mockResolvedValueOnce(llmSession(tenTracks([])));
    resolveAll();

    const session = await generateSession(
      { ...preset, adventure: 0 },
      { state: "A" },
    );
    expect(session.newCount).toBe(0);
  });

  it("passes anchor context through for entry state C", async () => {
    groqMock.mockResolvedValueOnce(llmSession(tenTracks()));
    resolveAll();

    await generateSession(preset, {
      state: "C",
      anchor: { title: "Innerbloom", artist: "RÜFÜS DU SOL" },
    });

    const messages = groqMock.mock.calls[0][1];
    const userMsg = messages.find((m) => m.role === "user")!.content;
    expect(userMsg).toContain("Innerbloom");
    expect(userMsg).toContain("STRONG anchor");
  });
});
