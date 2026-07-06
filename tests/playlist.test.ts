import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as Response;
}

const ownerToken = () => jsonResponse({ access_token: "owner-token" });
// Post-Feb-2026 /items shape: entries carry `item`, not `track`.
const playlistPage = (ids: string[], next: string | null = null) =>
  jsonResponse({ items: ids.map((id) => ({ item: { id } })), next });

async function loadModules() {
  const playlist = await import("@/lib/spotify/playlist");
  const errors = await import("@/lib/errors");
  return { ...playlist, ...errors };
}

beforeEach(() => {
  vi.resetModules();
  fetchMock.mockReset();
  process.env.SPOTIFY_CLIENT_ID = "id";
  process.env.SPOTIFY_CLIENT_SECRET = "secret";
  process.env.SPOTIFY_REFRESH_TOKEN = "refresh";
  process.env.SPOTIFY_PLAYLIST_ID = "playlist123";
});

afterEach(() => {
  for (const k of [
    "SPOTIFY_CLIENT_ID",
    "SPOTIFY_CLIENT_SECRET",
    "SPOTIFY_REFRESH_TOKEN",
    "SPOTIFY_PLAYLIST_ID",
  ]) {
    delete process.env[k];
  }
});

describe("saveToSharedPlaylist", () => {
  it("adds only tracks not already in the playlist (dedupe)", async () => {
    const { saveToSharedPlaylist } = await loadModules();
    fetchMock
      .mockResolvedValueOnce(ownerToken())
      .mockResolvedValueOnce(playlistPage(["existing1"]))
      .mockResolvedValueOnce(jsonResponse({ snapshot_id: "s" }));

    const result = await saveToSharedPlaylist(["existing1", "new1", "new1", "new2"]);

    expect(result.added).toBe(2);
    expect(result.alreadyThere).toBe(1);
    expect(result.playlistUrl).toBe("https://open.spotify.com/playlist/playlist123");

    const addBody = JSON.parse(fetchMock.mock.calls[2][1].body as string);
    expect(addBody.uris).toEqual(["spotify:track:new1", "spotify:track:new2"]);
    // both read and write must use the post-Feb-2026 /items endpoints
    expect(fetchMock.mock.calls[1][0]).toContain("/playlists/playlist123/items");
    expect(fetchMock.mock.calls[2][0]).toContain("/playlists/playlist123/items");
  });

  it("saving the same tracks twice adds nothing the second time", async () => {
    const { saveToSharedPlaylist } = await loadModules();
    fetchMock
      .mockResolvedValueOnce(ownerToken())
      .mockResolvedValueOnce(playlistPage(["a", "b"]));

    const result = await saveToSharedPlaylist(["a", "b"]);
    expect(result.added).toBe(0);
    expect(result.alreadyThere).toBe(2);
    // no third call — nothing to add
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("walks pagination when the playlist is large", async () => {
    const { saveToSharedPlaylist } = await loadModules();
    fetchMock
      .mockResolvedValueOnce(ownerToken())
      .mockResolvedValueOnce(playlistPage(["p1"], "https://api.spotify.com/v1/next-page"))
      .mockResolvedValueOnce(playlistPage(["p2"]))
      .mockResolvedValueOnce(jsonResponse({ snapshot_id: "s" }));

    const result = await saveToSharedPlaylist(["p2", "new1"]);
    expect(result.added).toBe(1);
    expect(result.alreadyThere).toBe(1);
  });

  it("empty selection → no-op without any network call", async () => {
    const { saveToSharedPlaylist } = await loadModules();
    const result = await saveToSharedPlaylist([]);
    expect(result.added).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws 503 when the owner token env is missing (Save hidden, app fine)", async () => {
    delete process.env.SPOTIFY_REFRESH_TOKEN;
    const { saveToSharedPlaylist } = await loadModules();

    await expect(saveToSharedPlaylist(["x"])).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
    // isSaveConfigured is what the UI reads to hide Save
    const { isSaveConfigured } = await import("@/lib/env");
    expect(isSaveConfigured).toBe(false);
  });

  it("expired/revoked refresh token → friendly error, no stack", async () => {
    const { saveToSharedPlaylist, FRIENDLY } = await loadModules();
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "invalid_grant" }, false));

    await expect(saveToSharedPlaylist(["x"])).rejects.toThrow(FRIENDLY.saveFailed);
  });

  it("network failure mid-add → friendly error", async () => {
    const { saveToSharedPlaylist, FRIENDLY } = await loadModules();
    fetchMock
      .mockResolvedValueOnce(ownerToken())
      .mockResolvedValueOnce(playlistPage([]))
      .mockRejectedValueOnce(new TypeError("fetch failed"));

    await expect(saveToSharedPlaylist(["x"])).rejects.toThrow(FRIENDLY.saveFailed);
  });
});
