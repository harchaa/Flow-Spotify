"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import StickyPlayer from "@/components/StickyPlayer";
import TrackCard from "@/components/TrackCard";
import { useLocalSnapshot } from "@/lib/hooks";
import {
  addDiscoveries,
  getPreset,
  getStoredSession,
  nudgeNovelty,
  setRecentPresetId,
  setStoredSession,
  updateStoredSession,
} from "@/lib/storage";
import type { GeneratedSession, StoredSession } from "@/lib/types";

type ViewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; session: StoredSession };

function SessionView() {
  const router = useRouter();
  const presetId = useSearchParams().get("preset");

  // Refresh mid-session → restore the stored session instead of regenerating.
  const restored = useLocalSnapshot(() => {
    if (!presetId) return null;
    const stored = getStoredSession();
    return stored && stored.presetId === presetId && stored.endedAt === null
      ? stored
      : null;
  }, null);

  const [view, setView] = useState<ViewState>({ status: "loading" });
  const [retryToken, setRetryToken] = useState(0);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const currentEndedRef = useRef(false);
  const skippedNewRef = useRef(false);

  useEffect(() => {
    const preset = presetId ? getPreset(presetId) : null;
    if (!preset) {
      router.replace("/setup");
      return;
    }
    setRecentPresetId(preset.id);
    if (restored) return;

    let cancelled = false;
    fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preset, entry: { state: "A" } }),
    })
      .then(async (res) => {
        const data = (await res.json()) as GeneratedSession & { error?: string };
        if (cancelled) return;
        if (!res.ok || data.error) {
          setView({
            status: "error",
            message: data.error ?? "Something went wrong. Please try again.",
          });
          return;
        }
        const session: StoredSession = {
          presetId: preset.id,
          presetName: preset.name,
          tracks: data.tracks,
          newCount: data.newCount,
          startedAt: Date.now(),
          endedAt: null,
          recapSeen: false,
        };
        setStoredSession(session);
        // Discoveries persist immediately — never lost, even if the tab closes.
        addDiscoveries(preset.id, data.tracks);
        setView({ status: "ready", session });
      })
      .catch(() => {
        if (!cancelled) {
          setView({ status: "error", message: "Something went wrong. Please try again." });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [presetId, restored, retryToken, router]);

  const effectiveView: ViewState = restored
    ? { status: "ready", session: restored }
    : view;
  const session = effectiveView.status === "ready" ? effectiveView.session : null;

  const selectTrack = (index: number) => {
    if (!session) return;
    // Leaving a NEW track before it finished = a quiet "less like this".
    if (
      playingIndex !== null &&
      index !== playingIndex &&
      !currentEndedRef.current &&
      session.tracks[playingIndex]?.isNew
    ) {
      nudgeNovelty(session.presetId, -0.5);
      skippedNewRef.current = true;
    }
    currentEndedRef.current = false;
    setPlayingIndex(index);
  };

  const handleTrackEnd = () => {
    currentEndedRef.current = true;
    if (!session || playingIndex === null) return;
    if (playingIndex < session.tracks.length - 1) {
      currentEndedRef.current = false;
      setPlayingIndex(playingIndex + 1);
    }
  };

  const endSession = () => {
    if (!session) return;
    // A calm session with no new-track skips lets novelty drift back up.
    if (!skippedNewRef.current) nudgeNovelty(session.presetId, 0.5);
    updateStoredSession({ endedAt: Date.now() });
    router.push("/recap");
  };

  const lessAdventurous = () => {
    if (!session) return;
    nudgeNovelty(session.presetId, -1);
  };

  if (effectiveView.status === "loading") {
    return (
      <div className="flex flex-col items-center gap-3 px-4 pt-24 text-center" role="status">
        <p className="text-lg font-medium">Building your session…</p>
        <p className="text-sm text-muted">Steady sound first. A little discovery, quietly.</p>
      </div>
    );
  }

  if (effectiveView.status === "error") {
    return (
      <div className="flex flex-col items-center gap-4 px-4 pt-24 text-center">
        <p className="text-base">{effectiveView.message}</p>
        <button
          type="button"
          onClick={() => {
            setView({ status: "loading" });
            setRetryToken((t) => t + 1);
          }}
          className="min-h-11 rounded-full bg-accent px-6 font-bold text-accent-contrast"
        >
          Try again
        </button>
        <Link href="/" className="text-sm text-muted underline">
          Back home
        </Link>
      </div>
    );
  }

  const tracks = session!.tracks;
  return (
    <div className="flex flex-col gap-4 px-4 pb-36 pt-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{session!.presetName}</h1>
          <p className="mt-1 text-sm text-muted" aria-live="polite">
            {session!.newCount === 0
              ? "All familiar this session."
              : `${session!.newCount} new ${session!.newCount === 1 ? "track" : "tracks"} added this session.`}
          </p>
        </div>
        <button
          type="button"
          onClick={endSession}
          className="min-h-11 shrink-0 rounded-full border border-white/15 px-4 text-sm font-medium"
        >
          End session
        </button>
      </header>

      <ul className="flex flex-col gap-1" aria-label="Session tracks">
        {tracks.map((track, i) => (
          <TrackCard
            key={track.id}
            track={track}
            isPlaying={playingIndex === i}
            onPlay={() => selectTrack(i)}
          />
        ))}
      </ul>

      <div className="mt-2 rounded-xl bg-surface p-4">
        <button
          type="button"
          onClick={lessAdventurous}
          className="min-h-11 w-full rounded-full border border-white/15 text-sm font-medium text-muted"
        >
          Less adventurous — keep future sessions more familiar
        </button>
      </div>

      {playingIndex !== null && (
        <StickyPlayer trackId={tracks[playingIndex].id} onTrackEnd={handleTrackEnd} />
      )}
    </div>
  );
}

export default function SessionPage() {
  return (
    <Suspense>
      <SessionView />
    </Suspense>
  );
}
