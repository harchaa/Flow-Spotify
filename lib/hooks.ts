"use client";

import { useRef, useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/** True after client hydration; false during SSR/prerender. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/**
 * Reads a browser-only value (localStorage) once on mount, with a stable
 * snapshot thereafter — the lint-clean alternative to setState-in-effect.
 */
export function useLocalSnapshot<T>(read: () => T, serverFallback: T): T {
  const cache = useRef<{ value: T } | undefined>(undefined);
  return useSyncExternalStore(
    noopSubscribe,
    () => (cache.current ??= { value: read() }).value,
    () => serverFallback,
  );
}
