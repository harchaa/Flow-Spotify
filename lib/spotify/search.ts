import { getAppToken } from "@/lib/spotify/clientCredentials";
import { ApiError, FRIENDLY, toApiError } from "@/lib/errors";

export type ResolvedTrack = {
  id: string;
  name: string;
  artist: string;
  albumArt: string | null;
  spotifyUrl: string;
};

type SpotifyTrackItem = {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { images: { url: string }[] };
  external_urls: { spotify: string };
};

async function runSearch(query: string): Promise<ResolvedTrack | null> {
  const token = await getAppToken();
  const url = `https://api.spotify.com/v1/search?type=track&limit=1&q=${encodeURIComponent(query)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    throw toApiError(err, FRIENDLY.spotifyDown);
  }
  if (!res.ok) throw new ApiError(FRIENDLY.spotifyDown);

  const data = (await res.json()) as {
    tracks?: { items?: SpotifyTrackItem[] };
  };
  const item = data.tracks?.items?.[0];
  if (!item) return null;

  return {
    id: item.id,
    name: item.name,
    artist: item.artists.map((a) => a.name).join(", "),
    albumArt: item.album.images[0]?.url ?? null,
    spotifyUrl: item.external_urls.spotify,
  };
}

/** Spotify's field filters break on embedded quotes — strip them. */
function clean(s: string): string {
  return s.replace(/["']/g, "").trim();
}

/**
 * Resolve an LLM-named track to a real Spotify track.
 * Scoped field query first for precision; one loose retry for tracks whose
 * canonical title differs slightly; null if Spotify has no match (caller
 * drops it and backfills).
 */
export async function searchTrack(
  title: string,
  artist: string,
): Promise<ResolvedTrack | null> {
  const scoped = await runSearch(
    `track:"${clean(title)}" artist:"${clean(artist)}"`,
  );
  if (scoped) return scoped;
  return runSearch(`${clean(title)} ${clean(artist)}`);
}
