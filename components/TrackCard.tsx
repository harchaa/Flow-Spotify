"use client";

/* eslint-disable @next/next/no-img-element -- album art comes from Spotify's CDN with unknown hostnames; next/image adds nothing for 48px thumbs */
import NewBadge from "@/components/NewBadge";
import type { SessionTrack } from "@/lib/types";

export type SaveState = "idle" | "saving" | "saved";

type Props = {
  track: SessionTrack;
  isPlaying: boolean;
  showReason?: boolean;
  onPlay?: () => void;
  /** When provided, renders a Save-to-playlist action (recap screen). */
  onSave?: () => void;
  saveState?: SaveState;
};

export default function TrackCard({
  track,
  isPlaying,
  showReason,
  onPlay,
  onSave,
  saveState = "idle",
}: Props) {
  return (
    <li
      className={`flex items-center gap-3 rounded-xl p-2 ${
        isPlaying ? "bg-surface-raised" : "bg-transparent"
      }`}
    >
      <button
        type="button"
        onClick={onPlay}
        disabled={!onPlay}
        aria-label={`Play ${track.name} by ${track.artist}`}
        className="flex min-h-11 flex-1 items-center gap-3 text-left"
      >
        {track.albumArt ? (
          <img
            src={track.albumArt}
            alt=""
            width={48}
            height={48}
            loading="lazy"
            className="h-12 w-12 shrink-0 rounded-md object-cover"
          />
        ) : (
          <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-surface-raised text-muted">
            ♪
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={`truncate text-sm font-medium ${isPlaying ? "text-accent-text" : ""}`}>
              {isPlaying && <span className="sr-only">Now playing: </span>}
              {track.name}
            </span>
            {track.isNew && <NewBadge />}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted">{track.artist}</span>
          {showReason && track.reason && (
            <span className="mt-1 block text-xs italic text-muted">{track.reason}</span>
          )}
        </span>
      </button>
      {onSave && (
        <button
          type="button"
          onClick={onSave}
          disabled={saveState !== "idle"}
          aria-label={
            saveState === "saved"
              ? `${track.name} saved to playlist`
              : `Save ${track.name} to the Flow Discoveries playlist`
          }
          className={`flex h-11 min-w-16 shrink-0 items-center justify-center rounded-full border px-3 text-xs font-semibold ${
            saveState === "saved"
              ? "border-accent-text/40 text-accent-text"
              : "border-white/15 text-foreground"
          }`}
        >
          {saveState === "saved" ? "✓ Saved" : saveState === "saving" ? "Saving…" : "Save"}
        </button>
      )}
      <a
        href={track.spotifyUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open ${track.name} in Spotify`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:text-foreground"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
          <path d="M14 3h7v7h-2V6.4l-8.3 8.3-1.4-1.4L17.6 5H14V3ZM5 5h6v2H7v10h10v-4h2v6H5V5Z" />
        </svg>
      </a>
    </li>
  );
}
