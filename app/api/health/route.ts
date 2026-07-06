import { NextRequest, NextResponse } from "next/server";
import { env, isGroqConfigured, isSaveConfigured, isSpotifyConfigured } from "@/lib/env";
import { getAppToken } from "@/lib/spotify/clientCredentials";

/**
 * GET /api/health          → which integrations are configured (env flags only)
 * GET /api/health?live=1   → also pings Spotify and Groq to prove the keys work
 * Never returns key material.
 */
export async function GET(req: NextRequest) {
  const configured = {
    groq: isGroqConfigured,
    spotify: isSpotifyConfigured,
    save: isSaveConfigured,
  };

  if (req.nextUrl.searchParams.get("live") !== "1") {
    return NextResponse.json({ configured });
  }

  const live: Record<string, boolean> = { spotify: false, groq: false };
  // Debug block: only HTTP statuses and non-secret value shapes (the client
  // id is public in OAuth; lengths reveal paste mistakes, never content).
  const debug: Record<string, unknown> = {
    clientIdLen: env.spotifyClientId.length,
    clientIdPrefix: env.spotifyClientId.slice(0, 3),
    secretLen: env.spotifyClientSecret.length,
    refreshTokenLen: env.spotifyRefreshToken.length,
    playlistIdLen: env.spotifyPlaylistId.length,
  };

  if (isSpotifyConfigured) {
    try {
      await getAppToken();
      live.spotify = true;
    } catch {
      live.spotify = false;
    }
    try {
      const res = await fetch("https://accounts.spotify.com/api/token", {
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
      debug.spotifyTokenStatus = res.status;
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        debug.spotifyTokenError = body.error ?? "unknown";
      }
    } catch (err) {
      debug.spotifyTokenStatus = "network-error";
      debug.spotifyTokenError = err instanceof Error ? err.name : "unknown";
    }
  }

  if (isGroqConfigured) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${env.groqApiKey}` },
        signal: AbortSignal.timeout(10_000),
      });
      live.groq = res.ok;
    } catch {
      live.groq = false;
    }
  }

  return NextResponse.json({ configured, live, debug });
}
