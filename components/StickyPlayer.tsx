"use client";

import { useEffect, useRef, useState } from "react";

/** Minimal typings for Spotify's IFrame Embed API (loaded from open.spotify.com). */
type EmbedController = {
  loadUri: (uri: string) => void;
  play: () => void;
  destroy: () => void;
  addListener: (
    event: "playback_update",
    cb: (e: { data: { position: number; duration: number; isPaused: boolean } }) => void,
  ) => void;
};
type IFrameAPI = {
  createController: (
    el: HTMLElement,
    options: { uri: string; width: string; height: number },
    cb: (controller: EmbedController) => void,
  ) => void;
};
declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: IFrameAPI) => void;
  }
}

const SCRIPT_SRC = "https://open.spotify.com/embed/iframe-api/v1";
const API_TIMEOUT_MS = 6000;

type Props = {
  trackId: string;
  /** Fires once when the current track plays to its end (drives auto-advance). */
  onTrackEnd: () => void;
};

/**
 * One docked Spotify embed (consumer embed — no login, no API key).
 * Uses the IFrame API so we can swap tracks in place and observe playback
 * (now-playing state, natural end → auto-advance). If the API script fails
 * to load, falls back to a plain per-track iframe: playback still works,
 * we just lose auto-advance.
 */
export default function StickyPlayer({ trackId, onTrackEnd }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<EmbedController | null>(null);
  const [mode, setMode] = useState<"loading" | "api" | "fallback">("loading");

  // Refs so the single controller listener always sees current values.
  const trackIdRef = useRef(trackId);
  const onTrackEndRef = useRef(onTrackEnd);
  const endedForRef = useRef<string | null>(null);
  useEffect(() => {
    trackIdRef.current = trackId;
    onTrackEndRef.current = onTrackEnd;
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;

    const timeout = window.setTimeout(() => {
      if (!controllerRef.current && !cancelled) setMode("fallback");
    }, API_TIMEOUT_MS);

    window.onSpotifyIframeApiReady = (api) => {
      if (cancelled) return;
      const mount = document.createElement("div");
      host.appendChild(mount);
      api.createController(
        mount,
        { uri: `spotify:track:${trackIdRef.current}`, width: "100%", height: 80 },
        (controller) => {
          if (cancelled) {
            controller.destroy();
            return;
          }
          controllerRef.current = controller;
          window.clearTimeout(timeout);
          setMode("api");
          // The user just tapped a track — start it without a second tap.
          controller.play();
          controller.addListener("playback_update", ({ data }) => {
            const nearEnd = data.duration > 0 && data.position >= data.duration - 400;
            if (nearEnd && endedForRef.current !== trackIdRef.current) {
              endedForRef.current = trackIdRef.current;
              onTrackEndRef.current();
            }
          });
        },
      );
    };

    if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.onerror = () => setMode("fallback");
      document.body.appendChild(script);
    }

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, []);

  // Track changed → load it into the existing controller.
  const lastLoadedRef = useRef<string | null>(null);
  useEffect(() => {
    if (mode !== "api" || !controllerRef.current) return;
    if (lastLoadedRef.current === null) {
      // First track was passed via createController's uri.
      lastLoadedRef.current = trackId;
      return;
    }
    if (lastLoadedRef.current !== trackId) {
      lastLoadedRef.current = trackId;
      controllerRef.current.loadUri(`spotify:track:${trackId}`);
      controllerRef.current.play();
    }
  }, [trackId, mode]);

  return (
    <div
      className="fixed bottom-[72px] left-1/2 z-[60] w-full max-w-[390px] -translate-x-1/2 px-2"
      aria-label="Player"
    >
      <div className="overflow-hidden rounded-xl bg-surface shadow-lg">
        <div ref={hostRef} className={mode === "fallback" ? "hidden" : ""} />
        {mode === "fallback" && (
          <iframe
            key={trackId}
            src={`https://open.spotify.com/embed/track/${trackId}`}
            width="100%"
            height="80"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            title="Spotify player"
          />
        )}
        {mode === "loading" && (
          <p className="px-4 py-3 text-xs text-muted">Loading player…</p>
        )}
      </div>
    </div>
  );
}
