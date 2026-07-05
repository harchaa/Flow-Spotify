import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as Response;
}

const tokenResponse = (token = "app-token", expiresIn = 3600) =>
  jsonResponse({ access_token: token, expires_in: expiresIn });

const trackItem = (overrides: Record<string, unknown> = {}) => ({
  id: "track1",
  name: "Midnight City",
  artists: [{ name: "M83" }],
  album: { images: [{ url: "https://img/art.jpg" }] },
  external_urls: { spotify: "https://open.spotify.com/track/track1" },
  ...overrides,
});

const searchResponse = (items: unknown[]) =>
  jsonResponse({ tracks: { items } });

async function loadModules() {
  const creds = await import("@/lib/spotify/clientCredentials");
  const search = await import("@/lib/spotify/search");
  const errors = await import("@/lib/errors");
  creds._resetTokenCache();
  return { ...creds, ...search, ...errors };
}

beforeEach(() => {
  vi.resetModules();
  fetchMock.mockReset();
  process.env.SPOTIFY_CLIENT_ID = "test-id";
  process.env.SPOTIFY_CLIENT_SECRET = "test-secret";
});

afterEach(() => {
  delete process.env.SPOTIFY_CLIENT_ID;
  delete process.env.SPOTIFY_CLIENT_SECRET;
});

describe("getAppToken (client credentials)", () => {
  it("fetches a token and caches it across calls", async () => {
    const { getAppToken } = await loadModules();
    fetchMock.mockResolvedValueOnce(tokenResponse());

    expect(await getAppToken()).toBe("app-token");
    expect(await getAppToken()).toBe("app-token");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refetches when the cached token is near expiry", async () => {
    const { getAppToken } = await loadModules();
    // expires_in 30s < the 60s safety margin → second call must refetch
    fetchMock
      .mockResolvedValueOnce(tokenResponse("short-lived", 30))
      .mockResolvedValueOnce(tokenResponse("fresh"));

    expect(await getAppToken()).toBe("short-lived");
    expect(await getAppToken()).toBe("fresh");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws a 503 ApiError when credentials are not configured", async () => {
    delete process.env.SPOTIFY_CLIENT_ID;
    delete process.env.SPOTIFY_CLIENT_SECRET;
    const { getAppToken, ApiError } = await loadModules();

    await expect(getAppToken()).rejects.toBeInstanceOf(ApiError);
    await expect(getAppToken()).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps a Spotify auth failure to a friendly error (no stack leak)", async () => {
    const { getAppToken, FRIENDLY } = await loadModules();
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "invalid_client" }, false));

    await expect(getAppToken()).rejects.toThrow(FRIENDLY.spotifyDown);
  });

  it("maps a network failure to a friendly error", async () => {
    const { getAppToken, FRIENDLY } = await loadModules();
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));

    await expect(getAppToken()).rejects.toThrow(FRIENDLY.spotifyDown);
  });
});

describe("searchTrack", () => {
  it("resolves a track via the scoped query and maps all fields", async () => {
    const { searchTrack } = await loadModules();
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(searchResponse([trackItem()]));

    const track = await searchTrack("Midnight City", "M83");
    expect(track).toEqual({
      id: "track1",
      name: "Midnight City",
      artist: "M83",
      albumArt: "https://img/art.jpg",
      spotifyUrl: "https://open.spotify.com/track/track1",
    });
    const scopedUrl = fetchMock.mock.calls[1][0] as string;
    expect(decodeURIComponent(scopedUrl)).toContain('track:"Midnight City" artist:"M83"');
  });

  it("falls back to a loose query when the scoped query misses", async () => {
    const { searchTrack } = await loadModules();
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(searchResponse([]))
      .mockResolvedValueOnce(searchResponse([trackItem()]));

    const track = await searchTrack("Midnight City", "M83");
    expect(track?.id).toBe("track1");
    const looseUrl = fetchMock.mock.calls[2][0] as string;
    expect(decodeURIComponent(looseUrl)).toContain("Midnight City M83");
    expect(decodeURIComponent(looseUrl)).not.toContain("track:");
  });

  it("returns null when both queries miss (caller drops + backfills)", async () => {
    const { searchTrack } = await loadModules();
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(searchResponse([]))
      .mockResolvedValueOnce(searchResponse([]));

    expect(await searchTrack("Nonexistent Song", "Nobody")).toBeNull();
  });

  it("strips embedded quotes that would break Spotify field filters", async () => {
    const { searchTrack } = await loadModules();
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(
        searchResponse([trackItem({ artists: [{ name: "D'Angelo" }] })]),
      );

    await searchTrack('Don"t Stop', "D'Angelo");
    const url = decodeURIComponent(fetchMock.mock.calls[1][0] as string);
    expect(url).toContain('track:"Dont Stop" artist:"DAngelo"');
  });

  it("rejects a popular-but-wrong-artist result instead of poisoning the session", async () => {
    const { searchTrack } = await loadModules();
    const wrongArtist = trackItem({ id: "wrong", artists: [{ name: "Pantera" }] });
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(searchResponse([wrongArtist]))
      .mockResolvedValueOnce(searchResponse([wrongArtist]));

    expect(await searchTrack("10s", "Four Tet")).toBeNull();
  });

  it("skips wrong-artist results and picks the matching one further down", async () => {
    const { searchTrack } = await loadModules();
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(
      searchResponse([
        trackItem({ id: "wrong", artists: [{ name: "Kanye West" }] }),
        trackItem({ id: "right", artists: [{ name: "M83" }] }),
      ]),
    );

    const track = await searchTrack("Midnight City", "M83");
    expect(track?.id).toBe("right");
  });

  it("matches artists case/diacritic-insensitively (RÜFÜS DU SOL ≈ rufus du sol)", async () => {
    const { searchTrack } = await loadModules();
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(
        searchResponse([trackItem({ artists: [{ name: "RÜFÜS DU SOL" }] })]),
      );

    const track = await searchTrack("Innerbloom", "Rufus Du Sol");
    expect(track).not.toBeNull();
  });

  it("joins multiple artists and tolerates missing album art", async () => {
    const { searchTrack } = await loadModules();
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(
      searchResponse([
        trackItem({
          artists: [{ name: "A" }, { name: "B" }],
          album: { images: [] },
        }),
      ]),
    );

    const track = await searchTrack("Song", "A");
    expect(track?.artist).toBe("A, B");
    expect(track?.albumArt).toBeNull();
  });

  it("maps a search HTTP failure to a friendly error", async () => {
    const { searchTrack, FRIENDLY } = await loadModules();
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({}, false));

    await expect(searchTrack("Song", "Artist")).rejects.toThrow(FRIENDLY.spotifyDown);
  });
});
