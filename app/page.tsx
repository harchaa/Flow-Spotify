"use client";

import Link from "next/link";
import { useState } from "react";
import FlowButton from "@/components/FlowButton";
import { ReduceMotionToggle } from "@/components/ReduceMotion";
import { useHydrated, useLocalSnapshot } from "@/lib/hooks";
import {
  getPendingRecap,
  getRecentPreset,
  getStoredSession,
  loadPresets,
  updateStoredSession,
} from "@/lib/storage";

const FILTER_PILLS = ["All", "Music", "Podcasts"] as const;

/** Static shell content — stands in for Spotify's own home tiles. */
const MOCK_TILES = [
  { name: "Liked Songs", art: "bg-gradient-to-br from-indigo-500 to-purple-400", icon: "♥" },
  { name: "Daily Mix 1", art: "bg-gradient-to-br from-rose-500 to-orange-400", icon: "♪" },
  { name: "Discover Weekly", art: "bg-gradient-to-br from-teal-500 to-cyan-400", icon: "◆" },
  { name: "Top Songs – Global", art: "bg-gradient-to-br from-violet-600 to-fuchsia-400", icon: "▲" },
];

const JUMP_BACK_IN = [
  { name: "Chill Instrumental Beats", art: "bg-gradient-to-br from-slate-500 to-slate-700" },
  { name: "Deep Focus", art: "bg-gradient-to-br from-emerald-700 to-teal-900" },
  { name: "lofi beats", art: "bg-gradient-to-br from-amber-600 to-rose-800" },
  { name: "Peaceful Piano", art: "bg-gradient-to-br from-sky-700 to-indigo-900" },
];

export default function HomePage() {
  const hydrated = useHydrated();
  const presets = useLocalSnapshot(loadPresets, []);
  const recentPreset = useLocalSnapshot(getRecentPreset, null);
  const pendingRecap = useLocalSnapshot(getPendingRecap, null);
  const runningSession = useLocalSnapshot(() => {
    const s = getStoredSession();
    return s && s.endedAt === null ? s : null;
  }, null);
  const [recapDismissed, setRecapDismissed] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [activePill, setActivePill] = useState<(typeof FILTER_PILLS)[number]>("All");

  const running = Boolean(runningSession) && !stopped;

  const stopFlow = () => {
    // Stopping saves silently (the user got busy) — the recap waits for
    // re-entry rather than interrupting now.
    updateStoredSession({ endedAt: Date.now() });
    setStopped(true);
  };

  const dismissRecap = () => {
    // Dismissible — discoveries are already safe in the preset's list.
    updateStoredSession({ recapSeen: true });
    setRecapDismissed(true);
  };

  const showRecap = pendingRecap && !recapDismissed && !running;

  return (
    <div className="flex flex-col gap-6 px-4 pt-6">
      {/* Spotify-style header: profile + filter pills */}
      <header className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pink-400 font-bold text-black"
        >
          H
        </span>
        <div className="flex gap-2" role="tablist" aria-label="Home filters">
          {FILTER_PILLS.map((pill) => (
            <button
              key={pill}
              type="button"
              role="tab"
              aria-selected={activePill === pill}
              onClick={() => setActivePill(pill)}
              className={`min-h-9 rounded-full px-4 text-sm font-medium ${
                activePill === pill
                  ? "bg-accent text-accent-contrast"
                  : "bg-surface-raised text-foreground"
              }`}
            >
              {pill}
            </button>
          ))}
        </div>
      </header>

      {/* Deferred recap: appears on re-entry, never mid-session. */}
      {showRecap && (
        <section
          aria-label="Discovery recap available"
          className="rounded-xl border border-accent-text/30 bg-surface p-4"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm leading-relaxed">
              Last {pendingRecap.presetName}:{" "}
              {pendingRecap.newCount === 0
                ? "all familiar, nothing to review."
                : `${pendingRecap.newCount} new ${
                    pendingRecap.newCount === 1 ? "song" : "songs"
                  } slipped in. Keep any?`}
            </p>
            <button
              type="button"
              onClick={dismissRecap}
              aria-label="Dismiss recap"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:text-foreground"
            >
              ✕
            </button>
          </div>
          {pendingRecap.newCount > 0 && (
            <Link
              href="/recap"
              className="mt-3 inline-flex min-h-10 items-center rounded-full bg-accent px-5 text-sm font-bold text-accent-contrast"
            >
              See discoveries
            </Link>
          )}
        </section>
      )}

      {/* Running session → quick way back (like Spotify's now-playing bar) */}
      {hydrated && running && runningSession && (
        <Link
          href={`/session?preset=${runningSession.presetId}`}
          className="flex items-center justify-between rounded-xl border border-accent-text/40 bg-surface-raised px-4 py-3"
        >
          <span className="text-sm font-medium">
            {runningSession.presetName} is running
          </span>
          <span className="text-xs font-semibold text-accent-text">Return →</span>
        </Link>
      )}

      {/* Spotify-style tile grid: shell playlists + the user's Flow presets */}
      <section aria-label="Your shortcuts" className="grid grid-cols-2 gap-2">
        {MOCK_TILES.map((tile) => (
          <div
            key={tile.name}
            className="flex min-h-14 items-center gap-2 overflow-hidden rounded-md bg-surface-raised"
          >
            <span
              aria-hidden="true"
              className={`flex h-14 w-14 shrink-0 items-center justify-center text-lg text-white ${tile.art}`}
            >
              {tile.icon}
            </span>
            <span className="truncate pr-2 text-xs font-semibold">{tile.name}</span>
          </div>
        ))}
        {hydrated &&
          presets.slice(0, 2).map((preset) => (
            <Link
              key={preset.id}
              href={`/session?preset=${preset.id}`}
              className="flex min-h-14 items-center gap-2 overflow-hidden rounded-md bg-surface-raised ring-1 ring-accent-text/30"
            >
              <span
                aria-hidden="true"
                className="flex h-14 w-14 shrink-0 items-center justify-center bg-accent text-lg font-bold text-accent-contrast"
              >
                F
              </span>
              <span className="min-w-0 pr-2">
                <span className="block truncate text-xs font-semibold">{preset.name}</span>
                <span className="block text-[10px] text-muted">Flow · endless focus</span>
              </span>
            </Link>
          ))}
      </section>

      {/* THE FEATURE: Flow embedded in the Spotify home */}
      <section
        aria-label="Flow — focus discovery"
        className="rounded-2xl bg-surface p-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Flow</h2>
          <span className="rounded-full bg-accent-contrast px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-accent-text">
            Focus discovery
          </span>
        </div>
        <p className="mt-1 text-sm text-muted">
          {recentPreset
            ? `Start your ${recentPreset.name}? Steady sound, a little discovery, quietly.`
            : "Consistent focus sessions that quietly work in new music — recapped when you're done."}
        </p>

        {hydrated && (
          <FlowButton
            presets={presets}
            recentPreset={recentPreset}
            running={running}
            onStop={stopFlow}
          />
        )}

        {hydrated && !recentPreset && (
          <Link
            href="/setup"
            className="mx-auto flex min-h-11 w-fit items-center rounded-full bg-accent px-6 text-sm font-bold text-accent-contrast"
          >
            Set up your first Flow
          </Link>
        )}
      </section>

      {/* Spotify-style "Jump back in" shelf (shell content) */}
      <section aria-label="Jump back in">
        <h2 className="text-lg font-bold">Jump back in</h2>
        <div className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-1">
          {JUMP_BACK_IN.map((tile) => (
            <div key={tile.name} className="w-28 shrink-0">
              <div
                aria-hidden="true"
                className={`flex h-28 w-28 items-end rounded-lg p-2 ${tile.art}`}
              >
                <span className="text-[11px] font-bold leading-tight text-white/90">
                  {tile.name}
                </span>
              </div>
              <p className="mt-1 truncate text-xs text-muted">{tile.name}</p>
            </div>
          ))}
        </div>
      </section>

      <ReduceMotionToggle />

      <p className="pb-2 text-center text-[10px] text-muted">
        Demo shell — Flow is the working feature; other tiles are illustrative.
      </p>
    </div>
  );
}
