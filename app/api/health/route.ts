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

  if (isSpotifyConfigured) {
    try {
      await getAppToken();
      live.spotify = true;
    } catch {
      live.spotify = false;
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

  return NextResponse.json({ configured, live });
}
