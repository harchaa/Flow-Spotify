import { env, isSpotifyConfigured } from "@/lib/env";
import { ApiError, FRIENDLY, toApiError } from "@/lib/errors";

/**
 * App-level Spotify token (client-credentials flow — no user login).
 * Cached in module scope; refetched when < 60s of life remains.
 * On serverless this cache is per-warm-instance, which is fine: the worst
 * case is one extra token call on a cold start.
 */
let cache: { token: string; expiresAt: number } | null = null;

export async function getAppToken(): Promise<string> {
  if (!isSpotifyConfigured) {
    throw new ApiError(FRIENDLY.notConfigured, 503);
  }
  if (cache && cache.expiresAt - Date.now() > 60_000) {
    return cache.token;
  }

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
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    throw toApiError(err, FRIENDLY.spotifyDown);
  }

  if (!res.ok) {
    throw new ApiError(FRIENDLY.spotifyDown);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cache = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cache.token;
}

/** Test-only: clear the module-scope token cache. */
export function _resetTokenCache() {
  cache = null;
}
