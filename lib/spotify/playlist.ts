import { env, isSaveConfigured } from "@/lib/env";
import { ApiError, FRIENDLY, toApiError } from "@/lib/errors";

/**
 * Shared-playlist Save: the app always acts as the playlist OWNER via a
 * stored refresh token (one-time setup: scripts/get-refresh-token.mjs), so
 * visitors can save discoveries to the public "Flow Discoveries" playlist
 * without ever logging in. Spotify's dev-mode 5-user OAuth cap never applies.
 */

async function getOwnerToken(): Promise<string> {
  let res: Response;
  try {
    res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${env.spotifyClientId}:${env.spotifyClientSecret}`,
        ).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: env.spotifyRefreshToken,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    throw toApiError(err, FRIENDLY.saveFailed);
  }
  if (!res.ok) throw new ApiError(FRIENDLY.saveFailed);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new ApiError(FRIENDLY.saveFailed);
  return data.access_token;
}

/** All track ids already in the playlist (paginated). */
async function getExistingTrackIds(token: string): Promise<Set<string>> {
  const ids = new Set<string>();
  let url: string | null =
    `https://api.spotify.com/v1/playlists/${env.spotifyPlaylistId}/tracks?fields=items(track(id)),next&limit=100`;

  while (url) {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      throw toApiError(err, FRIENDLY.saveFailed);
    }
    if (!res.ok) throw new ApiError(FRIENDLY.saveFailed);
    const data = (await res.json()) as {
      items?: { track?: { id?: string } }[];
      next?: string | null;
    };
    for (const item of data.items ?? []) {
      if (item.track?.id) ids.add(item.track.id);
    }
    url = data.next ?? null;
  }
  return ids;
}

export type SaveResult = {
  added: number;
  alreadyThere: number;
  playlistUrl: string;
};

/** Adds tracks to the shared playlist, skipping ones already in it. */
export async function saveToSharedPlaylist(trackIds: string[]): Promise<SaveResult> {
  if (!isSaveConfigured) throw new ApiError(FRIENDLY.notConfigured, 503);

  const playlistUrl = `https://open.spotify.com/playlist/${env.spotifyPlaylistId}`;
  const unique = [...new Set(trackIds)];
  if (unique.length === 0) {
    return { added: 0, alreadyThere: 0, playlistUrl };
  }

  const token = await getOwnerToken();
  const existing = await getExistingTrackIds(token);
  const toAdd = unique.filter((id) => !existing.has(id));
  if (toAdd.length === 0) {
    return { added: 0, alreadyThere: unique.length, playlistUrl };
  }

  let res: Response;
  try {
    res = await fetch(
      `https://api.spotify.com/v1/playlists/${env.spotifyPlaylistId}/tracks`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uris: toAdd.map((id) => `spotify:track:${id}`),
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
  } catch (err) {
    throw toApiError(err, FRIENDLY.saveFailed);
  }
  if (!res.ok) throw new ApiError(FRIENDLY.saveFailed);

  return {
    added: toAdd.length,
    alreadyThere: unique.length - toAdd.length,
    playlistUrl,
  };
}
