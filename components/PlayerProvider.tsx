"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

/** Minimal typings for Spotify's IFrame Embed API. */
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

export type PlayerMeta = { title: string; subtitle?: string };
type Current = { uri: string; meta: PlayerMeta };

type PlayerApi = {
  current: Current | null;
  /** Load any Spotify URI (track/playlist/show/album) into the global dock. */
  play: (uri: string, meta: PlayerMeta) => void;
  stop: () => void;
  /** Pages can react to a TRACK finishing (session auto-advance). */
  setTrackEndHandler: (fn: (() => void) | null) => void;
};

const PlayerContext = createContext<PlayerApi | null>(null);

/** The IFrame API object arrives once per page load — cache it for re-boots. */
let cachedApi: IFrameAPI | null = null;

export function usePlayer(): PlayerApi {
  const api = useContext(PlayerContext);
  if (!api) throw new Error("usePlayer must be used inside PlayerProvider");
  return api;
}

const uriKind = (uri: string) => uri.split(":")[1] ?? "track";
const embedUrl = (uri: string) => {
  const [, kind, id] = uri.split(":");
  return `https://open.spotify.com/embed/${kind}/${id}`;
};
/** Compact bar for single tracks; taller card (art + controls) for collections. */
const dockHeight = (uri: string, expanded: boolean) =>
  expanded ? 352 : uriKind(uri) === "track" ? 80 : 152;

/**
 * ONE Spotify embed for the whole app, docked above the bottom nav like
 * Spotify's mini-player. It lives in the layout, so audio keeps playing
 * across navigation; pages just call play(uri).
 */
export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<Current | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<"idle" | "loading" | "api" | "fallback">("idle");

  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<EmbedController | null>(null);
  const initializedRef = useRef(false);
  const currentUriRef = useRef<string | null>(null);
  const endedForRef = useRef<string | null>(null);
  const trackEndRef = useRef<(() => void) | null>(null);

  const setTrackEndHandler = useCallback((fn: (() => void) | null) => {
    trackEndRef.current = fn;
  }, []);

  const play = useCallback((uri: string, meta: PlayerMeta) => {
    currentUriRef.current = uri;
    setCurrent({ uri, meta });
    setExpanded(uriKind(uri) !== "track");
    if (controllerRef.current) {
      controllerRef.current.loadUri(uri);
      controllerRef.current.play();
    }
  }, []);

  const stop = useCallback(() => {
    controllerRef.current?.destroy();
    controllerRef.current = null;
    initializedRef.current = false;
    currentUriRef.current = null;
    setCurrent(null);
    setMode("idle");
    setExpanded(false);
  }, []);

  // Boot the IFrame API on first play (the host div must be rendered first).
  useEffect(() => {
    if (!current || initializedRef.current) return;
    const host = hostRef.current;
    if (!host) return;
    initializedRef.current = true;
    setMode("loading");
    let cancelled = false;

    const timeout = window.setTimeout(() => {
      if (!controllerRef.current && !cancelled) setMode("fallback");
    }, API_TIMEOUT_MS);

    const boot = (api: IFrameAPI) => {
      const mount = document.createElement("div");
      host.appendChild(mount);
      api.createController(
        mount,
        { uri: currentUriRef.current ?? current.uri, width: "100%", height: 152 },
        (controller) => {
          if (cancelled) {
            controller.destroy();
            return;
          }
          controllerRef.current = controller;
          window.clearTimeout(timeout);
          setMode("api");
          controller.play();
          // Catch up if play() was called again while the API was booting.
          if (currentUriRef.current && currentUriRef.current !== current.uri) {
            controller.loadUri(currentUriRef.current);
            controller.play();
          }
          controller.addListener("playback_update", ({ data }) => {
            const uri = currentUriRef.current;
            if (!uri || uriKind(uri) !== "track") return;
            const nearEnd = data.duration > 0 && data.position >= data.duration - 400;
            if (nearEnd && endedForRef.current !== uri) {
              endedForRef.current = uri;
              trackEndRef.current?.();
            }
          });
        },
      );
    };

    if (cachedApi) {
      boot(cachedApi);
    } else {
      window.onSpotifyIframeApiReady = (api) => {
        cachedApi = api;
        if (!cancelled) boot(api);
      };
      if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
        const script = document.createElement("script");
        script.src = SCRIPT_SRC;
        script.async = true;
        script.onerror = () => setMode("fallback");
        document.body.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [current]);

  // Size the embed for what's playing (compact track bar vs collection card).
  useEffect(() => {
    if (!current) return;
    const h = dockHeight(current.uri, expanded);
    hostRef.current
      ?.querySelectorAll("iframe")
      .forEach((frame) => frame.setAttribute("height", String(h)));
  }, [current, expanded, mode]);

  // Give scrolling pages breathing room above the dock.
  useEffect(() => {
    document.body.classList.toggle("player-open", current !== null);
  }, [current]);

  return (
    <PlayerContext.Provider value={{ current, play, stop, setTrackEndHandler }}>
      {children}

      <div
        aria-label="Player"
        className={`fixed bottom-[76px] left-1/2 z-[60] w-full max-w-[390px] -translate-x-1/2 px-2 ${
          current ? "" : "hidden"
        }`}
      >
        <div className="overflow-hidden rounded-xl bg-surface-raised shadow-2xl">
          <div className="flex items-center justify-between gap-2 px-3 py-1.5">
            <p className="min-w-0 truncate text-xs font-medium">
              {current?.meta.title}
              {current?.meta.subtitle && (
                <span className="text-muted"> · {current.meta.subtitle}</span>
              )}
            </p>
            <span className="flex shrink-0 items-center">
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                aria-label={expanded ? "Collapse player" : "Expand player"}
                aria-expanded={expanded}
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:text-foreground"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                  {expanded ? (
                    <path d="M12 15.5 4.5 8 6 6.5l6 6 6-6L19.5 8 12 15.5Z" />
                  ) : (
                    <path d="M12 8.5 19.5 16 18 17.5l-6-6-6 6L4.5 16 12 8.5Z" />
                  )}
                </svg>
              </button>
              <button
                type="button"
                onClick={stop}
                aria-label="Close player"
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:text-foreground"
              >
                ✕
              </button>
            </span>
          </div>

          <div ref={hostRef} className={mode === "fallback" ? "hidden" : ""} />
          {mode === "fallback" && current && (
            <iframe
              key={current.uri}
              src={embedUrl(current.uri)}
              width="100%"
              height={dockHeight(current.uri, expanded)}
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
    </PlayerContext.Provider>
  );
}
