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

async function runSearch(query: string, limit = 3): Promise<SpotifyTrackItem[]> {
  const token = await getAppToken();
  const url = `https://api.spotify.com/v1/search?type=track&limit=${limit}&q=${encodeURIComponent(query)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    throw toApiError(err, FRIENDLY.spotifyDown);
  }
  // Rate limit gets its own status + message so callers can stop early
  // instead of burning the remaining quota on doomed retries.
  if (res.status === 429) throw new ApiError(FRIENDLY.spotifyBusy, 429);
  if (!res.ok) throw new ApiError(FRIENDLY.spotifyDown);

  const data = (await res.json()) as {
    tracks?: { items?: SpotifyTrackItem[] };
  };
  return data.tracks?.items ?? [];
}

/** Spotify's field filters break on embedded quotes — strip them. */
function clean(s: string): string {
  return s.replace(/["']/g, "").trim();
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Guards against wrong matches: a result only counts if the artist we asked
 * for genuinely appears among the track's artists. Without this, the loose
 * query happily returns a popular but unrelated track (e.g. a metal song in
 * a mellow instrumental session).
 */
function artistMatches(requested: string, item: SpotifyTrackItem): boolean {
  const wanted = normalize(requested);
  if (!wanted) return false;
  return item.artists.some((a) => {
    const got = normalize(a.name);
    if (!got) return false;
    if (got.includes(wanted) || wanted.includes(got)) return true;
    const wantedTokens = wanted.split(" ").filter((t) => t.length > 1);
    const gotTokens = new Set(got.split(" "));
    const common = wantedTokens.filter((t) => gotTokens.has(t));
    return wantedTokens.length > 0 && common.length >= Math.ceil(wantedTokens.length / 2);
  });
}

function toResolved(item: SpotifyTrackItem): ResolvedTrack {
  return {
    id: item.id,
    name: item.name,
    artist: item.artists.map((a) => a.name).join(", "),
    albumArt: item.album.images[0]?.url ?? null,
    spotifyUrl: item.external_urls.spotify,
  };
}

/**
 * Resolve an LLM-named track to a real Spotify track.
 * Scoped field query first for precision; one loose retry for tracks whose
 * canonical title differs slightly. Either way the artist must verify, or
 * we return null and the caller drops + backfills.
 */
/** Free-text search for the Search screen (user-typed query, no artist guard). */
export async function searchTracksList(
  query: string,
  limit = 5,
): Promise<ResolvedTrack[]> {
  const items = await runSearch(query.trim(), limit);
  return items.map(toResolved);
}

export async function searchTrack(
  title: string,
  artist: string,
): Promise<ResolvedTrack | null> {
  const scoped = await runSearch(
    `track:"${clean(title)}" artist:"${clean(artist)}"`,
  );
  const scopedHit = scoped.find((item) => artistMatches(artist, item));
  if (scopedHit) return toResolved(scopedHit);

  const loose = await runSearch(`${clean(title)} ${clean(artist)}`);
  const looseHit = loose.find((item) => artistMatches(artist, item));
  return looseHit ? toResolved(looseHit) : null;
}
