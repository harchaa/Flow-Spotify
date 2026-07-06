"use client";

import Link from "next/link";
import { useState } from "react";
import TrackCard from "@/components/TrackCard";
import { useHydrated, useLocalSnapshot } from "@/lib/hooks";
import {
  deletePreset,
  getDiscoveries,
  loadPresets,
  savePreset,
} from "@/lib/storage";
import type { Preset } from "@/lib/types";

function PresetCard({
  preset,
  onChange,
  onDelete,
}: {
  preset: Preset;
  onChange: (p: Preset) => void;
  onDelete: () => void;
}) {
  const discoveries = useLocalSnapshot(() => getDiscoveries(preset.id), []);
  const [showDiscoveries, setShowDiscoveries] = useState(false);
  const [feedInput, setFeedInput] = useState("");

  const toggleFavourite = () =>
    onChange({ ...preset, favourite: !preset.favourite });

  const feedMore = () => {
    const name = feedInput.trim();
    if (!name) return;
    if (!preset.seedArtists.some((a) => a.toLowerCase() === name.toLowerCase())) {
      onChange({ ...preset, seedArtists: [...preset.seedArtists, name].slice(0, 6) });
    }
    setFeedInput("");
  };

  return (
    <li className="rounded-xl bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">{preset.name}</h2>
          <p className="mt-0.5 text-xs text-muted">
            {preset.seedArtists.length > 0
              ? `Taste: ${preset.seedArtists.join(", ")}`
              : "No artists yet — feed it below"}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleFavourite}
          aria-pressed={preset.favourite}
          aria-label={`${preset.favourite ? "Remove" : "Mark"} ${preset.name} as favourite (favourites appear in the Flow menu)`}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg ${
            preset.favourite ? "text-accent-text" : "text-muted"
          }`}
        >
          {preset.favourite ? "★" : "☆"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link
          href={`/session?preset=${preset.id}`}
          className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-sm font-bold text-accent-contrast"
        >
          ▶ Play
        </Link>
        <button
          type="button"
          onClick={() => setShowDiscoveries(!showDiscoveries)}
          aria-expanded={showDiscoveries}
          className="min-h-11 rounded-full border border-white/15 px-4 text-sm font-medium"
        >
          Discoveries ({discoveries.length})
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${preset.name}`}
          className="min-h-11 rounded-full px-3 text-sm text-muted underline"
        >
          Delete
        </button>
      </div>

      <div className="mt-3 flex gap-2">
        <label htmlFor={`feed-${preset.id}`} className="sr-only">
          Add an artist to {preset.name}
        </label>
        <input
          id={`feed-${preset.id}`}
          type="text"
          value={feedInput}
          onChange={(e) => setFeedInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              feedMore();
            }
          }}
          placeholder="Feed it more — add an artist"
          className="min-h-11 flex-1 rounded-lg border border-white/15 bg-background px-3 text-sm placeholder:text-muted focus:border-accent-text focus:outline-none"
        />
        <button
          type="button"
          onClick={feedMore}
          className="min-h-11 rounded-lg bg-surface-raised px-4 text-sm font-medium"
        >
          Add
        </button>
      </div>

      {showDiscoveries &&
        (discoveries.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No discoveries yet — they collect here as Flow quietly adds new tracks.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-1" aria-label={`${preset.name} discoveries`}>
            {discoveries.map((track) => (
              <TrackCard key={track.id} track={track} isPlaying={false} showReason />
            ))}
          </ul>
        ))}
    </li>
  );
}

export default function LibraryPage() {
  const hydrated = useHydrated();
  const initial = useLocalSnapshot(loadPresets, []);
  const [presets, setPresets] = useState<Preset[] | null>(null);
  const list = presets ?? initial;

  const update = (next: Preset) => {
    savePreset(next);
    setPresets(list.map((p) => (p.id === next.id ? next : p)));
  };

  const remove = (id: string) => {
    deletePreset(id);
    setPresets(list.filter((p) => p.id !== id));
  };

  return (
    <div className="flex flex-col gap-5 px-4 pt-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your Library</h1>
        <Link
          href="/setup"
          className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-4 text-sm font-medium"
        >
          + New preset
        </Link>
      </header>

      {hydrated &&
        (list.length === 0 ? (
          <div className="rounded-xl bg-surface p-5">
            <p className="text-sm text-muted">
              No Flow presets yet. Set one up and your presets — with every track
              Flow discovers for them — will live here.
            </p>
            <Link
              href="/setup"
              className="mt-4 inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-sm font-bold text-accent-contrast"
            >
              Set up a Flow
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-3" aria-label="Your Flow presets">
            {list.map((preset) => (
              <PresetCard
                key={preset.id}
                preset={preset}
                onChange={update}
                onDelete={() => remove(preset.id)}
              />
            ))}
          </ul>
        ))}
    </div>
  );
}
