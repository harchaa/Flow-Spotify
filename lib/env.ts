/**
 * Single config module. Every secret is read here and ONLY here,
 * and this module must never be imported from client code.
 */
if (typeof window !== "undefined") {
  throw new Error("lib/env.ts was imported in the browser — secrets must stay server-side.");
}

export const env = {
  groqApiKey: process.env.GROQ_API_KEY ?? "",
  spotifyClientId: process.env.SPOTIFY_CLIENT_ID ?? "",
  spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? "",
  // Optional — powers the shared-playlist Save. The app runs without them.
  spotifyRefreshToken: process.env.SPOTIFY_REFRESH_TOKEN ?? "",
  spotifyPlaylistId: process.env.SPOTIFY_PLAYLIST_ID ?? "",
};

export const isGroqConfigured = Boolean(env.groqApiKey);
export const isSpotifyConfigured = Boolean(
  env.spotifyClientId && env.spotifyClientSecret,
);
export const isSaveConfigured = Boolean(
  isSpotifyConfigured && env.spotifyRefreshToken && env.spotifyPlaylistId,
);
