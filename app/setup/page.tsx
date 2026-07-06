"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import AdventureDial from "@/components/AdventureDial";
import { savePreset, setRecentPresetId } from "@/lib/storage";
import { PRESET_KINDS, type Preset, type PresetKind } from "@/lib/types";

/** Sessions are endless — this only sizes the first generated batch. */
const INITIAL_BATCH_MINUTES = 35;

/** Smart defaults per kind — shown, editable, adventure defaults LOW. */
const DEFAULTS: Record<PresetKind, { energy: number; instrumentalOnly: boolean }> = {
  Study: { energy: 1, instrumentalOnly: true },
  Work: { energy: 3, instrumentalOnly: false },
  Code: { energy: 2, instrumentalOnly: true },
  Read: { energy: 1, instrumentalOnly: true },
};

export default function SetupPage() {
  const router = useRouter();
  const [kind, setKind] = useState<PresetKind>("Code");
  const [artists, setArtists] = useState<string[]>([]);
  const [artistInput, setArtistInput] = useState("");
  const [energy, setEnergy] = useState(DEFAULTS.Code.energy);
  const [instrumentalOnly, setInstrumentalOnly] = useState(DEFAULTS.Code.instrumentalOnly);
  const [adventure, setAdventure] = useState(1);

  const pickKind = (k: PresetKind) => {
    setKind(k);
    setEnergy(DEFAULTS[k].energy);
    setInstrumentalOnly(DEFAULTS[k].instrumentalOnly);
  };

  const addArtist = () => {
    const name = artistInput.trim();
    if (!name || artists.length >= 3) return;
    if (!artists.some((a) => a.toLowerCase() === name.toLowerCase())) {
      setArtists([...artists, name]);
    }
    setArtistInput("");
  };

  const start = () => {
    const preset: Preset = {
      id: `preset-${Date.now()}`,
      kind,
      name: `${kind} Flow`,
      seedArtists: artists,
      energy,
      instrumentalOnly,
      sessionLength: INITIAL_BATCH_MINUTES,
      adventure,
      favourite: true,
      noveltyNudge: 0,
      createdAt: Date.now(),
    };
    savePreset(preset);
    setRecentPresetId(preset.id);
    router.push(`/session?preset=${preset.id}`);
  };

  return (
    <div className="flex flex-col gap-6 px-4 pt-8">
      <header>
        <h1 className="text-2xl font-bold">Set up your Flow</h1>
        <p className="mt-1 text-sm text-muted">
          One quick screen — you can tune everything later.
        </p>
      </header>

      <fieldset>
        <legend className="text-sm font-medium">What are you focusing on?</legend>
        <div className="mt-2 grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Preset type">
          {PRESET_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => pickKind(k)}
              className={`min-h-11 rounded-full border text-sm font-medium ${
                kind === k
                  ? "border-accent-text bg-accent-contrast text-accent-text"
                  : "border-white/15 text-muted"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="artist-input" className="text-sm font-medium">
          Artists you focus to <span className="text-muted">(2–3 works best)</span>
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="artist-input"
            type="text"
            value={artistInput}
            onChange={(e) => setArtistInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addArtist();
              }
            }}
            placeholder="e.g. Tycho"
            className="min-h-11 flex-1 rounded-lg border border-white/15 bg-surface px-3 text-sm placeholder:text-muted focus:border-accent-text focus:outline-none"
          />
          <button
            type="button"
            onClick={addArtist}
            disabled={artists.length >= 3}
            className="min-h-11 rounded-lg bg-surface-raised px-4 text-sm font-medium disabled:opacity-40"
          >
            Add
          </button>
        </div>
        {artists.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Chosen artists">
            {artists.map((a) => (
              <li key={a}>
                <button
                  type="button"
                  onClick={() => setArtists(artists.filter((x) => x !== a))}
                  aria-label={`Remove ${a}`}
                  className="flex min-h-9 items-center gap-1.5 rounded-full bg-surface-raised px-3 text-sm"
                >
                  {a} <span aria-hidden="true" className="text-muted">✕</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-muted">
            No artists yet? That’s fine — we’ll open with safe, widely loved picks.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="energy" className="text-sm font-medium">
          Energy: <span className="text-muted">{["very calm", "calm", "moderate", "upbeat", "energetic"][energy - 1]}</span>
        </label>
        <input
          id="energy"
          type="range"
          min={1}
          max={5}
          step={1}
          value={energy}
          onChange={(e) => setEnergy(Number(e.target.value))}
          className="mt-2 w-full accent-[var(--accent)]"
        />
      </div>

      <div className="flex items-center justify-between">
        <label htmlFor="instrumental" className="text-sm font-medium">
          Instrumental only
        </label>
        <button
          id="instrumental"
          type="button"
          role="switch"
          aria-checked={instrumentalOnly}
          onClick={() => setInstrumentalOnly(!instrumentalOnly)}
          className={`relative h-7 w-12 rounded-full transition-colors ${
            instrumentalOnly ? "bg-accent" : "bg-surface-raised"
          }`}
        >
          <span className="sr-only">Instrumental only</span>
          <span
            aria-hidden="true"
            className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
              instrumentalOnly ? "left-6" : "left-1"
            }`}
          />
        </button>
      </div>

      <AdventureDial value={adventure} onChange={setAdventure} />

      <p className="text-xs text-muted">
        Sessions run as long as you do — Flow keeps the music coming until you stop.
      </p>

      <button
        type="button"
        onClick={start}
        className="min-h-12 rounded-full bg-accent text-base font-bold text-accent-contrast"
      >
        Start {kind} Flow
      </button>
    </div>
  );
}
