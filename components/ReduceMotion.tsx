"use client";

import { useEffect, useState } from "react";
import { useLocalSnapshot } from "@/lib/hooks";
import { getReduceMotion, setReduceMotion } from "@/lib/storage";

/** Applies the stored reduce-motion preference on first load (any page). */
export function MotionInit() {
  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", getReduceMotion());
  }, []);
  return null;
}

/** The user-facing toggle (shown on Home). */
export function ReduceMotionToggle() {
  const stored = useLocalSnapshot(getReduceMotion, false);
  const [override, setOverride] = useState<boolean | null>(null);
  const on = override ?? stored;

  const toggle = () => {
    setReduceMotion(!on);
    setOverride(!on);
  };

  return (
    <div className="flex items-center justify-between rounded-xl bg-surface px-4 py-3">
      <label htmlFor="reduce-motion" className="text-sm">
        Reduce motion
      </label>
      <button
        id="reduce-motion"
        type="button"
        role="switch"
        aria-checked={on}
        onClick={toggle}
        className={`relative h-7 w-12 rounded-full transition-colors ${
          on ? "bg-accent" : "bg-surface-raised"
        }`}
      >
        <span className="sr-only">Reduce motion</span>
        <span
          aria-hidden="true"
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
            on ? "left-6" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}
