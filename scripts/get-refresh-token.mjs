#!/usr/bin/env node
/**
 * ONE-TIME owner setup for the shared "Flow Discoveries" playlist.
 *
 * What it does:
 *   1. Runs the Spotify Authorization Code flow as YOU (the playlist owner)
 *      with scope playlist-modify-public, redirect http://127.0.0.1:8080
 *      (add that exact URI in the Spotify developer dashboard).
 *   2. Finds or creates the public playlist "Flow Discoveries".
 *   3. Prints SPOTIFY_REFRESH_TOKEN and SPOTIFY_PLAYLIST_ID to paste into
 *      .env.local (and your host's env when deploying).
 *
 * Run from the repo root:  node scripts/get-refresh-token.mjs
 * No visitor ever logs in; the app uses the refresh token server-side.
 */
import { createServer } from "node:http";
import { exec } from "node:child_process";
import { readFileSync } from "node:fs";

const PORT = 8080;
const REDIRECT_URI = `http://127.0.0.1:${PORT}`;
const PLAYLIST_NAME = "Flow Discoveries";

// Read credentials from the environment, falling back to .env.local.
function loadEnv() {
  const fromFile = {};
  try {
    for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m) fromFile[m[1]] = m[2].trim();
    }
  } catch {
    /* .env.local optional if vars are exported */
  }
  const id = process.env.SPOTIFY_CLIENT_ID || fromFile.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET || fromFile.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) {
    console.error("Missing SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET (env or .env.local).");
    process.exit(1);
  }
  return { id, secret };
}

const { id: clientId, secret: clientSecret } = loadEnv();
const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

const authorizeUrl =
  "https://accounts.spotify.com/authorize?" +
  new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: "playlist-modify-public",
  });

async function exchangeCode(code) {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function api(path, token, init = {}) {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function findOrCreatePlaylist(token) {
  const me = await api("/me", token);
  let page = await api("/me/playlists?limit=50", token);
  while (true) {
    const hit = page.items.find(
      (p) => p.name === PLAYLIST_NAME && p.owner?.id === me.id,
    );
    if (hit) return { playlist: hit, created: false };
    if (!page.next) break;
    page = await api(page.next.replace("https://api.spotify.com/v1", ""), token);
  }
  const playlist = await api(`/users/${encodeURIComponent(me.id)}/playlists`, token, {
    method: "POST",
    body: JSON.stringify({
      name: PLAYLIST_NAME,
      public: true,
      description: "New tracks quietly discovered during Flow focus sessions.",
    }),
  });
  return { playlist, created: true };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  if (!code && !error) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(
    error
      ? `<p>Authorization failed: ${error}. You can close this tab and re-run the script.</p>`
      : "<p>Authorized ✔ — you can close this tab and return to the terminal.</p>",
  );
  server.close();
  if (error) {
    console.error(`\nAuthorization failed: ${error}`);
    process.exit(1);
  }

  try {
    const tokens = await exchangeCode(code);
    const { playlist, created } = await findOrCreatePlaylist(tokens.access_token);

    console.log(`\n${created ? "Created" : "Found existing"} playlist "${PLAYLIST_NAME}".`);
    console.log(`Open it: ${playlist.external_urls.spotify}\n`);
    console.log("Paste these into .env.local (and your deploy host's env):\n");
    console.log(`SPOTIFY_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log(`SPOTIFY_PLAYLIST_ID=${playlist.id}\n`);
  } catch (err) {
    console.error(`\n${err.message}`);
    process.exit(1);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("Opening Spotify authorization in your browser…");
  console.log(`If it doesn't open, visit:\n\n${authorizeUrl}\n`);
  exec(`open "${authorizeUrl}"`); // macOS; on other platforms open the printed URL
});
