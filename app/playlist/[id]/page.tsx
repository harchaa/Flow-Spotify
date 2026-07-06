"use client";

/* eslint-disable @next/next/no-img-element -- Spotify CDN cover art */
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { usePlayer } from "@/components/PlayerProvider";

/**
 * Real playlist view. Playing loads the playlist into the GLOBAL docked
 * player (Spotify's consumer embed), so audio keeps going while the visitor
 * browses the rest of the app — item-level API reads are locked for
 * third-party playlists post-2026, so the embed is the playback path.
 */
function PlaylistView() {
  const router = useRouter();
  const player = usePlayer();
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const name = search.get("name") ?? "Playlist";
  const image = search.get("img");
  const owner = search.get("owner") ?? "Spotify user";

  const playing = player.current?.uri === `spotify:playlist:${id}`;

  return (
    <div className="flex flex-col gap-5 px-4 pt-6">
      <header className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
            <path d="M15.5 4.5 8 12l7.5 7.5L14 21l-9-9 9-9 1.5 1.5Z" />
          </svg>
        </button>
      </header>

      <div className="flex flex-col items-center gap-4 text-center">
        {image ? (
          <img
            src={image}
            alt=""
            className="aspect-square w-56 rounded-lg object-cover shadow-2xl"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex aspect-square w-56 items-center justify-center rounded-lg bg-surface text-5xl text-muted"
          >
            ♪
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold leading-snug">{name}</h1>
          <p className="mt-1 text-sm text-muted">Playlist · {owner}</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() =>
              player.play(`spotify:playlist:${id}`, { title: name, subtitle: owner })
            }
            className="flex min-h-12 items-center gap-2 rounded-full bg-accent px-7 text-base font-bold text-accent-contrast"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
              <path d="M8 5.5v13l11-6.5L8 5.5Z" />
            </svg>
            {playing ? "Playing" : "Play"}
          </button>
          <a
            href={`https://open.spotify.com/playlist/${id}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${name} in Spotify`}
            className="flex min-h-12 items-center rounded-full border border-white/15 px-5 text-sm font-medium"
          >
            Open in Spotify ↗
          </a>
        </div>

        <p className="max-w-64 text-xs text-muted">
          Plays in the mini-player below — keeps going while you browse. Expand it
          to see the tracklist.
        </p>
      </div>
    </div>
  );
}

export default function PlaylistPage() {
  return (
    <Suspense>
      <PlaylistView />
    </Suspense>
  );
}
