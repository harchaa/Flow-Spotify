"use client";

/* eslint-disable @next/next/no-img-element -- Spotify CDN art, 48px thumbs */
import { useRouter } from "next/navigation";
import { useState } from "react";
import PresetPickerSheet from "@/components/PresetPickerSheet";
import { useLocalSnapshot } from "@/lib/hooks";
import { loadPresets, savePreset } from "@/lib/storage";
import type { Preset } from "@/lib/types";
import type { ResolvedTrack } from "@/lib/spotify/search";

type Picking =
  | { mode: "start"; track: ResolvedTrack }
  | { mode: "add"; track: ResolvedTrack }
  | null;

export default function SearchPage() {
  const router = useRouter();
  const presets = useLocalSnapshot(loadPresets, []);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ResolvedTrack[] | null>(null);
  const [status, setStatus] = useState<"idle" | "searching" | "error">("idle");
  const [picking, setPicking] = useState<Picking>(null);
  const [addedNote, setAddedNote] = useState<string | null>(null);

  const search = () => {
    const q = query.trim();
    if (!q) return;
    setStatus("searching");
    setAddedNote(null);
    fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then(async (res) => {
        const data = (await res.json()) as { tracks?: ResolvedTrack[]; error?: string };
        if (!res.ok || !data.tracks) throw new Error(data.error);
        setResults(data.tracks);
        setStatus("idle");
      })
      .catch(() => setStatus("error"));
  };

  const startFlowFrom = (track: ResolvedTrack, preset: Preset) => {
    const params = new URLSearchParams({
      preset: preset.id,
      state: "C",
      anchorTitle: track.name,
      anchorArtist: track.artist,
    });
    router.push(`/session?${params}`);
  };

  const addToPreset = (track: ResolvedTrack, preset: Preset) => {
    // MVP: feeding a song teaches the preset its artist's sound.
    const artist = track.artist.split(",")[0].trim();
    if (!preset.seedArtists.some((a) => a.toLowerCase() === artist.toLowerCase())) {
      savePreset({
        ...preset,
        seedArtists: [...preset.seedArtists, artist].slice(0, 6),
      });
    }
    setAddedNote(`Added ${artist} to ${preset.name}'s taste.`);
    setPicking(null);
  };

  return (
    <div className="flex flex-col gap-5 px-4 pt-8">
      <h1 className="text-2xl font-bold">Search</h1>

      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
        className="flex gap-2"
      >
        <label htmlFor="search-input" className="sr-only">
          What do you want to focus to?
        </label>
        <input
          id="search-input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="What do you want to focus to?"
          className="min-h-11 flex-1 rounded-full border border-white/15 bg-surface px-4 text-sm placeholder:text-muted focus:border-accent-text focus:outline-none"
        />
        <button
          type="submit"
          className="min-h-11 rounded-full bg-accent px-5 text-sm font-bold text-accent-contrast"
        >
          Search
        </button>
      </form>

      {addedNote && (
        <p role="status" className="rounded-xl bg-accent-contrast px-4 py-3 text-sm text-accent-text">
          {addedNote}
        </p>
      )}

      {status === "searching" && (
        <p role="status" className="text-sm text-muted">
          Searching…
        </p>
      )}
      {status === "error" && (
        <p role="alert" className="text-sm text-danger-text">
          Search isn’t working right now. Please try again.
        </p>
      )}
      {results !== null && status === "idle" && results.length === 0 && (
        <p className="text-sm text-muted">Nothing found — try a different search.</p>
      )}

      {results !== null && results.length > 0 && (
        <ul className="flex flex-col gap-3" aria-label="Search results">
          {results.map((track) => (
            <li key={track.id} className="rounded-xl bg-surface p-3">
              <div className="flex items-center gap-3">
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
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{track.name}</p>
                  <p className="truncate text-xs text-muted">{track.artist}</p>
                </div>
                <a
                  href={track.spotifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${track.name} in Spotify`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                    <path d="M14 3h7v7h-2V6.4l-8.3 8.3-1.4-1.4L17.6 5H14V3ZM5 5h6v2H7v10h10v-4h2v6H5V5Z" />
                  </svg>
                </a>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setPicking({ mode: "start", track })}
                  className="min-h-11 flex-1 rounded-full bg-accent text-xs font-bold text-accent-contrast"
                >
                  Start a Flow from this
                </button>
                <button
                  type="button"
                  onClick={() => setPicking({ mode: "add", track })}
                  className="min-h-11 flex-1 rounded-full border border-white/15 text-xs font-medium"
                >
                  Add to a Flow preset
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <PresetPickerSheet
        open={picking !== null}
        title={
          picking?.mode === "start"
            ? `Start a Flow from “${picking.track.name}”`
            : `Add “${picking?.track.name ?? ""}” to which preset?`
        }
        presets={presets}
        onPick={(preset) => {
          if (!picking) return;
          if (picking.mode === "start") startFlowFrom(picking.track, preset);
          else addToPreset(picking.track, preset);
        }}
        onClose={() => setPicking(null)}
      />
    </div>
  );
}
