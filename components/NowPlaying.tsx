"use client";

/* eslint-disable @next/next/no-img-element -- Spotify CDN album art */
import { useEffect } from "react";
import NewBadge from "@/components/NewBadge";
import type { SessionTrack } from "@/lib/types";

type Props = {
  track: SessionTrack;
  presetName: string;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
};

/**
 * Full-screen Now Playing view (Spotify-style): big art, track info, and
 * prev/next around the docked embed player, which stays mounted beneath —
 * moving the iframe would reload it and stop the audio.
 */
export default function NowPlaying({
  track,
  presetName,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onClose,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Now playing: ${track.name} by ${track.artist}`}
      className="fixed inset-0 z-50 mx-auto flex w-full max-w-[390px] flex-col bg-gradient-to-b from-surface-raised to-background px-5 pb-44 pt-4"
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to track list"
          className="flex h-11 w-11 items-center justify-center rounded-full text-foreground"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
            <path d="M12 15.5 4.5 8 6 6.5l6 6 6-6L19.5 8 12 15.5Z" />
          </svg>
        </button>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {presetName}
        </p>
        <span className="h-11 w-11" aria-hidden="true" />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        {track.albumArt ? (
          <img
            src={track.albumArt}
            alt=""
            className="aspect-square w-full max-w-[300px] rounded-xl object-cover shadow-2xl"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex aspect-square w-full max-w-[300px] items-center justify-center rounded-xl bg-surface text-6xl text-muted"
          >
            ♪
          </div>
        )}

        <div className="w-full text-center">
          <div className="flex items-center justify-center gap-2">
            <h1 className="truncate text-xl font-bold">{track.name}</h1>
            {track.isNew && <NewBadge />}
          </div>
          <p className="mt-1 truncate text-sm text-muted">{track.artist}</p>
          {track.isNew && track.reason && (
            <p className="mt-2 text-xs italic text-muted">{track.reason}</p>
          )}
        </div>

        <div className="flex items-center gap-10">
          <button
            type="button"
            onClick={onPrev}
            disabled={!hasPrev}
            aria-label="Previous track"
            className="flex h-14 w-14 items-center justify-center rounded-full text-foreground disabled:opacity-30"
          >
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor" aria-hidden="true">
              <path d="M6 5h2v14H6V5Zm12 .8v12.4L9.5 12 18 5.8Z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!hasNext}
            aria-label="Next track"
            className="flex h-14 w-14 items-center justify-center rounded-full text-foreground disabled:opacity-30"
          >
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor" aria-hidden="true">
              <path d="M16 5h2v14h-2V5ZM6 5.8 14.5 12 6 18.2V5.8Z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
