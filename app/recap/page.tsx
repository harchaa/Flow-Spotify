"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import TrackCard from "@/components/TrackCard";
import { useHydrated, useLocalSnapshot } from "@/lib/hooks";
import { RECAP_FALLBACK } from "@/lib/groq/prompts";
import { getStoredSession, updateStoredSession } from "@/lib/storage";

export default function RecapPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const session = useLocalSnapshot(getStoredSession, null);
  const [llmHeadline, setLlmHeadline] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    // Seeing the recap clears the re-entry prompt; an abandoned session
    // counts as ended the moment its recap is viewed.
    updateStoredSession({ recapSeen: true, endedAt: session.endedAt ?? Date.now() });

    const newTracks = session.tracks.filter((t) => t.isNew);
    if (newTracks.length === 0) return;

    const controller = new AbortController();
    fetch("/api/recap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        presetName: session.presetName,
        newTracks: newTracks.map((t) => ({ name: t.name, artist: t.artist })),
      }),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data: { headline?: string }) => {
        if (data.headline) setLlmHeadline(data.headline);
      })
      .catch(() => {
        /* template fallback below already covers this */
      });
    return () => controller.abort();
  }, [session]);

  if (!hydrated) return null;

  if (!session) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 pt-24 text-center">
        <p className="text-base">No recent session to recap.</p>
        <Link href="/" className="text-sm text-accent-text underline">
          Back home
        </Link>
      </div>
    );
  }

  const discoveries = session.tracks.filter((t) => t.isNew);
  const headline =
    llmHeadline ?? RECAP_FALLBACK(session.presetName, discoveries.length);

  return (
    <div className="flex flex-col gap-5 px-4 pt-8">
      <header>
        <p className="text-sm font-medium text-accent-text">Discovery recap</p>
        <h1 className="mt-1 text-2xl font-bold leading-snug" aria-live="polite">
          {headline}
        </h1>
      </header>

      {discoveries.length === 0 ? (
        <div className="rounded-xl bg-surface p-5">
          <p className="text-sm text-muted">
            This session stayed fully familiar — sometimes that’s exactly right.
            Turn the adventure dial up when you’re ready for more.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="New tracks from this session">
          {discoveries.map((track) => (
            <TrackCard key={track.id} track={track} isPlaying={false} showReason />
          ))}
        </ul>
      )}

      <p className="text-xs text-muted">
        These are saved to your preset’s Discoveries, so you can come back to them
        anytime from Your Library.
      </p>

      <button
        type="button"
        onClick={() => router.push("/")}
        className="min-h-12 rounded-full bg-accent text-base font-bold text-accent-contrast"
      >
        Done
      </button>
    </div>
  );
}
