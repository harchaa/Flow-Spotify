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

export default function HomePage() {
  const hydrated = useHydrated();
  const presets = useLocalSnapshot(loadPresets, []);
  const recentPreset = useLocalSnapshot(getRecentPreset, null);
  const pendingRecap = useLocalSnapshot(getPendingRecap, null);
  const wasRunning = useLocalSnapshot(
    () => getStoredSession()?.endedAt === null,
    false,
  );
  const [recapDismissed, setRecapDismissed] = useState(false);
  const [stopped, setStopped] = useState(false);

  const running = wasRunning && !stopped;

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
    <div className="flex flex-col gap-6 px-4 pt-8">
      <header className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-accent font-bold text-accent-contrast"
        >
          F
        </span>
        <h1 className="text-2xl font-bold">Flow</h1>
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

      {hydrated && (
        <FlowButton
          presets={presets}
          recentPreset={recentPreset}
          running={running}
          onStop={stopFlow}
        />
      )}

      {hydrated &&
        (recentPreset ? (
          !running && (
            <section className="rounded-xl bg-surface p-5" aria-label="Start a Flow">
              <h2 className="text-lg font-semibold">Start your {recentPreset.name}?</h2>
              <p className="mt-1 text-sm text-muted">
                {recentPreset.sessionLength} min · steady{" "}
                {["very calm", "calm", "moderate", "upbeat", "energetic"][recentPreset.energy - 1]}{" "}
                sound
              </p>
              <div className="mt-4 flex gap-2">
                <Link
                  href={`/session?preset=${recentPreset.id}`}
                  className="inline-flex min-h-11 items-center rounded-full bg-accent px-6 text-sm font-bold text-accent-contrast"
                >
                  Start Flow
                </Link>
                <Link
                  href="/setup"
                  className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-5 text-sm font-medium text-muted"
                >
                  New preset
                </Link>
              </div>
            </section>
          )
        ) : (
          <section className="rounded-xl bg-surface p-5">
            <h2 className="text-lg font-semibold">Focus without the loop</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Consistent sessions for deep work, with a few new tracks slipped in
              quietly — recapped when your attention is free.
            </p>
            <Link
              href="/setup"
              className="mt-4 inline-flex min-h-11 items-center rounded-full bg-accent px-6 text-sm font-bold text-accent-contrast"
            >
              Set up your first Flow
            </Link>
          </section>
        ))}

      <ReduceMotionToggle />
    </div>
  );
}
