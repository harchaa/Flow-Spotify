"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

/**
 * Real playlist view: Spotify's consumer playlist embed shows the full
 * tracklist and plays in-browser with no login and no API calls — item-level
 * reads are locked for third-party playlists post-2026, so the embed IS the
 * functional path.
 */
function PlaylistView() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const name = useSearchParams().get("name") ?? "Playlist";

  return (
    <div className="flex flex-col gap-4 px-4 pt-6">
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
        <h1 className="min-w-0 truncate text-xl font-bold">{name}</h1>
      </header>

      <div className="overflow-hidden rounded-xl bg-surface">
        <iframe
          src={`https://open.spotify.com/embed/playlist/${id}`}
          width="100%"
          height="560"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          title={`${name} on Spotify`}
        />
      </div>

      <a
        href={`https://open.spotify.com/playlist/${id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mx-auto inline-flex min-h-11 items-center rounded-full border border-white/15 px-5 text-sm font-medium"
      >
        Open in Spotify ↗
      </a>
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
