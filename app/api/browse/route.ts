import { NextResponse } from "next/server";
import { getAppToken } from "@/lib/spotify/clientCredentials";
import { isSpotifyConfigured } from "@/lib/env";

export type BrowseTile = {
  id: string;
  name: string;
  image: string | null;
  owner: string;
};

/** Focus-adjacent shelves — real public playlists found via Search. */
const GRID_QUERIES = ["lofi beats", "deep focus", "peaceful piano", "chill hits"];
const SHELF_QUERIES = [
  "chill instrumental",
  "coding music",
  "ambient focus",
  "study jazz",
  "classical focus",
];
/** Real podcasts for the Podcasts filter (playable via show embeds). */
const SHOW_QUERIES = [
  "ted talks daily",
  "science vs",
  "huberman lab",
  "the daily",
  "planet money",
  "deep questions",
];

type CacheShape = { grid: BrowseTile[]; shelf: BrowseTile[]; shows: BrowseTile[] };
let cache: { data: CacheShape; expiresAt: number } | null = null;

async function findCandidates(query: string, token: string): Promise<BrowseTile[]> {
  try {
    const res = await fetch(
      `https://api.spotify.com/v1/search?type=playlist&limit=5&q=${encodeURIComponent(query)}`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      playlists?: {
        items?: ({
          id: string;
          name: string;
          images?: { url: string }[];
          owner?: { display_name?: string };
        } | null)[];
      };
    };
    return (data.playlists?.items ?? [])
      .filter((p): p is NonNullable<typeof p> => Boolean(p?.images?.[0]?.url))
      .map((p) => ({
        id: p.id,
        name: p.name,
        image: p.images?.[0]?.url ?? null,
        owner: p.owner?.display_name ?? "Spotify user",
      }));
  } catch {
    return [];
  }
}

async function findShow(query: string, token: string): Promise<BrowseTile | null> {
  try {
    const res = await fetch(
      `https://api.spotify.com/v1/search?type=show&limit=1&q=${encodeURIComponent(query)}`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      shows?: {
        items?: ({
          id: string;
          name: string;
          images?: { url: string }[];
          publisher?: string;
        } | null)[];
      };
    };
    const hit = data.shows?.items?.filter(Boolean)[0];
    if (!hit) return null;
    return {
      id: hit.id,
      name: hit.name,
      image: hit.images?.[0]?.url ?? null,
      owner: hit.publisher ?? "Podcast",
    };
  } catch {
    return null;
  }
}

/** One tile per query, never repeating a playlist across tiles. */
function pickDistinct(candidateLists: BrowseTile[][], used: Set<string>): BrowseTile[] {
  const tiles: BrowseTile[] = [];
  for (const candidates of candidateLists) {
    const pick = candidates.find((c) => !used.has(c.id));
    if (pick) {
      used.add(pick.id);
      tiles.push(pick);
    }
  }
  return tiles;
}

/**
 * GET /api/browse — real public playlists for the home shell (cover art +
 * names via Search; playback via the consumer embed, no login). Cached for
 * an hour per server instance and at the edge; degrades to empty lists so
 * the home page can fall back to static tiles.
 */
export async function GET() {
  if (!isSpotifyConfigured) {
    return NextResponse.json({ grid: [], shelf: [], shows: [] });
  }
  if (cache && cache.expiresAt > Date.now()) {
    return NextResponse.json(cache.data, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  }

  try {
    const token = await getAppToken();
    const [gridLists, shelfLists, shows] = await Promise.all([
      Promise.all(GRID_QUERIES.map((q) => findCandidates(q, token))),
      Promise.all(SHELF_QUERIES.map((q) => findCandidates(q, token))),
      Promise.all(SHOW_QUERIES.map((q) => findShow(q, token))),
    ]);
    const used = new Set<string>();
    const data: CacheShape = {
      grid: pickDistinct(gridLists, used),
      shelf: pickDistinct(shelfLists, used),
      shows: shows.filter(Boolean) as BrowseTile[],
    };
    cache = { data, expiresAt: Date.now() + 60 * 60 * 1000 };
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch {
    return NextResponse.json({ grid: [], shelf: [], shows: [] });
  }
}
