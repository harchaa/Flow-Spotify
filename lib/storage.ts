import { z } from "zod";
import {
  PresetSchema,
  SessionTrackSchema,
  StoredSessionSchema,
  type Preset,
  type SessionTrack,
  type StoredSession,
} from "@/lib/types";

/**
 * All persistence is browser localStorage (MVP choice: no accounts, no DB).
 * Every read is zod-validated with a safe fallback, so corrupted or stale
 * data can never crash the app. Keys are versioned for forward compatibility.
 */
const KEYS = {
  presets: "flow:v1:presets",
  recentPresetId: "flow:v1:recentPresetId",
  discoveries: "flow:v1:discoveries",
  session: "flow:v1:session",
  reduceMotion: "flow:v1:reduceMotion",
  customKinds: "flow:v1:customKinds",
} as const;

function read<T>(key: string, schema: z.ZodType<T>, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota/private-mode failures degrade silently; the session still plays.
  }
}

// ---- Presets ----------------------------------------------------------------

export function loadPresets(): Preset[] {
  return read(KEYS.presets, z.array(PresetSchema), []);
}

export function savePreset(preset: Preset) {
  const presets = loadPresets().filter((p) => p.id !== preset.id);
  write(KEYS.presets, [...presets, preset]);
}

export function deletePreset(presetId: string) {
  write(KEYS.presets, loadPresets().filter((p) => p.id !== presetId));
  if (getRecentPresetId() === presetId) {
    window.localStorage.removeItem(KEYS.recentPresetId);
  }
}

export function getPreset(presetId: string): Preset | null {
  return loadPresets().find((p) => p.id === presetId) ?? null;
}

export function getRecentPresetId(): string | null {
  return read(KEYS.recentPresetId, z.string(), "") || null;
}

export function setRecentPresetId(presetId: string) {
  write(KEYS.recentPresetId, presetId);
}

/** Most-recent preset, falling back to the newest one. */
export function getRecentPreset(): Preset | null {
  const presets = loadPresets();
  if (presets.length === 0) return null;
  const recent = presets.find((p) => p.id === getRecentPresetId());
  return recent ?? presets.sort((a, b) => b.createdAt - a.createdAt)[0];
}

/**
 * Skip-learning signal: a skip on a new track softly lowers future novelty
 * (clamped); it drifts back toward 0 by +0.5 after each calm session.
 */
export function nudgeNovelty(presetId: string, delta: number) {
  const preset = getPreset(presetId);
  if (!preset) return;
  savePreset({
    ...preset,
    noveltyNudge: Math.min(0, Math.max(-2, preset.noveltyNudge + delta)),
  });
}

// ---- Discoveries (per preset, never lost) -----------------------------------

const DiscoveriesSchema = z.record(z.string(), z.array(SessionTrackSchema));

export function getDiscoveries(presetId: string): SessionTrack[] {
  return read(KEYS.discoveries, DiscoveriesSchema, {})[presetId] ?? [];
}

/** Adds a session's new tracks to the preset's Discoveries list (deduped). */
export function addDiscoveries(presetId: string, tracks: SessionTrack[]) {
  const all = read(KEYS.discoveries, DiscoveriesSchema, {});
  const existing = all[presetId] ?? [];
  const seen = new Set(existing.map((t) => t.id));
  const fresh = tracks.filter((t) => t.isNew && !seen.has(t.id));
  if (fresh.length === 0) return;
  write(KEYS.discoveries, { ...all, [presetId]: [...existing, ...fresh] });
}

// ---- Current / last session --------------------------------------------------

export function getStoredSession(): StoredSession | null {
  return read(KEYS.session, StoredSessionSchema.nullable(), null);
}

export function setStoredSession(session: StoredSession) {
  write(KEYS.session, session);
}

export function updateStoredSession(patch: Partial<StoredSession>) {
  const current = getStoredSession();
  if (current) write(KEYS.session, { ...current, ...patch });
}

export function clearStoredSession() {
  if (typeof window !== "undefined") window.localStorage.removeItem(KEYS.session);
}

/** A finished-or-abandoned session whose recap hasn't been seen → re-entry prompt. */
export function getPendingRecap(): StoredSession | null {
  const session = getStoredSession();
  return session && !session.recapSeen ? session : null;
}

// ---- Custom focus types (user-added kinds beyond Study/Work/Code/Read) -------

export function getCustomKinds(): string[] {
  return read(KEYS.customKinds, z.array(z.string()), []);
}

export function addCustomKind(kind: string) {
  const clean = kind.trim();
  if (!clean) return;
  const kinds = getCustomKinds();
  if (!kinds.some((k) => k.toLowerCase() === clean.toLowerCase())) {
    write(KEYS.customKinds, [...kinds, clean].slice(0, 12));
  }
}

// ---- Preferences -------------------------------------------------------------

export function getReduceMotion(): boolean {
  return read(KEYS.reduceMotion, z.boolean(), false);
}

export function setReduceMotion(on: boolean) {
  write(KEYS.reduceMotion, on);
  document.documentElement.classList.toggle("reduce-motion", on);
}
