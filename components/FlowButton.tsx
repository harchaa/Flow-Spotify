"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import PresetPickerSheet from "@/components/PresetPickerSheet";
import { OFF_TARGET, pickTarget, radialPositions, type Point } from "@/lib/radial";
import type { Preset } from "@/lib/types";

const HOLD_MS = 350;

type Props = {
  presets: Preset[];
  recentPreset: Preset | null;
  running: boolean;
  onStop: () => void;
};

/**
 * The Flow button. Quick TAP starts the most-recent preset. HOLD fans the
 * favourited presets into a radial; DRAG toward one and release to start it.
 * While a Flow runs, HOLD shows an OFF target below — drag to it to stop.
 * Keyboard/screen-reader path: Enter/Space opens the same choices as a list
 * (the radial is progressive enhancement, never the only way).
 */
export default function FlowButton({ presets, recentPreset, running, onStop }: Props) {
  const router = useRouter();
  const favourites = presets.filter((p) => p.favourite).slice(0, 5);

  const [radialOpen, setRadialOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const holdTimer = useRef<number | null>(null);
  const heldRef = useRef(false);
  const originRef = useRef<Point>({ x: 0, y: 0 });

  const positions = radialPositions(favourites.length);
  const targets: Point[] = running ? [...positions, OFF_TARGET] : positions;
  const highlighted = radialOpen ? pickTarget(offset, targets) : null;

  const startPreset = (preset: Preset) => {
    router.push(`/session?preset=${preset.id}`);
  };

  const startRecent = () => {
    if (recentPreset) startPreset(recentPreset);
    else router.push("/setup");
  };

  const cancelHold = () => {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    originRef.current = { x: e.clientX, y: e.clientY };
    heldRef.current = false;
    setOffset({ x: 0, y: 0 });
    holdTimer.current = window.setTimeout(() => {
      heldRef.current = true;
      setRadialOpen(true);
    }, HOLD_MS);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!heldRef.current) return;
    setOffset({
      x: e.clientX - originRef.current.x,
      y: e.clientY - originRef.current.y,
    });
  };

  const onPointerUp = () => {
    cancelHold();
    if (!heldRef.current) {
      // Quick tap.
      startRecent();
      return;
    }
    setRadialOpen(false);
    if (highlighted === null) return; // released outside every target → cancel
    if (running && highlighted === targets.length - 1) onStop();
    else startPreset(favourites[highlighted]);
  };

  const onPointerCancel = () => {
    cancelHold();
    setRadialOpen(false);
  };

  return (
    <div className="relative flex flex-col items-center py-6">
      {/* Radial overlay */}
      {radialOpen && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10">
          {favourites.map((preset, i) => (
            <span
              key={preset.id}
              style={{
                transform: `translate(${positions[i].x}px, ${positions[i].y}px)`,
              }}
              className={`absolute left-1/2 top-1/2 -ml-10 -mt-5 flex h-10 w-20 items-center justify-center rounded-full text-xs font-semibold ${
                highlighted === i
                  ? "bg-accent text-accent-contrast"
                  : "bg-surface-raised text-foreground"
              }`}
            >
              {preset.kind}
            </span>
          ))}
          {running && (
            <span
              style={{
                transform: `translate(${OFF_TARGET.x}px, ${OFF_TARGET.y}px)`,
              }}
              className={`absolute left-1/2 top-1/2 -ml-10 -mt-5 flex h-10 w-20 items-center justify-center rounded-full text-xs font-bold ${
                highlighted === targets.length - 1
                  ? "bg-danger-text text-black"
                  : "border border-white/25 text-foreground"
              }`}
            >
              OFF
            </span>
          )}
        </div>
      )}

      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setSheetOpen(true);
          }
        }}
        aria-label={
          running
            ? "Flow is running. Open Flow menu to switch preset or stop"
            : "Start Flow. Tap for your recent preset, hold for all presets"
        }
        aria-haspopup="dialog"
        className={`z-20 flex h-24 w-24 touch-none select-none items-center justify-center rounded-full text-xl font-extrabold shadow-lg ${
          running
            ? "bg-accent-contrast text-accent-text ring-2 ring-accent-text"
            : "bg-accent text-accent-contrast"
        }`}
      >
        Flow
      </button>

      <p className="mt-3 text-xs text-muted" aria-hidden="true">
        {running
          ? "Hold and drag to OFF to stop"
          : recentPreset
            ? `Tap: ${recentPreset.name} · Hold: choose`
            : "Tap to set up your first Flow"}
      </p>

      {/* Accessible fallback: the same actions as a plain list */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="mt-1 min-h-11 rounded-full px-4 text-xs text-muted underline"
      >
        Choose a preset from a list
      </button>

      <PresetPickerSheet
        open={sheetOpen}
        title="Start a Flow"
        presets={presets}
        onPick={(p) => {
          setSheetOpen(false);
          startPreset(p);
        }}
        onClose={() => setSheetOpen(false)}
        extraLabel={running ? "Stop the running Flow" : undefined}
        onExtra={
          running
            ? () => {
                setSheetOpen(false);
                onStop();
              }
            : undefined
        }
      />
    </div>
  );
}
