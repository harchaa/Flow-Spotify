"use client";

import { useEffect, useRef } from "react";
import type { Preset } from "@/lib/types";

type Props = {
  open: boolean;
  title: string;
  presets: Preset[];
  onPick: (preset: Preset) => void;
  onClose: () => void;
  /** Optional extra action rendered below the presets (e.g. "Stop Flow"). */
  extraLabel?: string;
  onExtra?: () => void;
};

/**
 * Bottom sheet listing presets — the accessible path to everything the
 * radial gesture does (keyboard, screen readers, or anyone who prefers taps).
 */
export default function PresetPickerSheet({
  open,
  title,
  presets,
  onPick,
  onClose,
  extraLabel,
  onExtra,
}: Props) {
  const firstButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    firstButtonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[390px] rounded-t-2xl bg-surface-raised p-4 pb-8"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted"
          >
            ✕
          </button>
        </div>
        <ul className="mt-3 flex flex-col gap-2">
          {presets.map((preset, i) => (
            <li key={preset.id}>
              <button
                ref={i === 0 ? firstButtonRef : undefined}
                type="button"
                onClick={() => onPick(preset)}
                className="flex min-h-12 w-full items-center justify-between rounded-xl bg-surface px-4 text-left text-sm font-medium"
              >
                {preset.name}
                <span className="text-xs text-muted">{preset.kind}</span>
              </button>
            </li>
          ))}
          {presets.length === 0 && (
            <li className="px-1 py-2 text-sm text-muted">No presets yet.</li>
          )}
        </ul>
        {extraLabel && onExtra && (
          <button
            type="button"
            onClick={onExtra}
            className="mt-3 min-h-11 w-full rounded-full border border-white/20 text-sm font-medium"
          >
            {extraLabel}
          </button>
        )}
      </div>
    </div>
  );
}
