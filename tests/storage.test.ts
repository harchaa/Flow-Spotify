import { beforeEach, describe, expect, it } from "vitest";
import type { Preset, SessionTrack, StoredSession } from "@/lib/types";

/** Minimal localStorage + document stand-ins so storage runs under node. */
function fakeBrowser() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  const classes = new Set<string>();
  const documentStub = {
    documentElement: {
      classList: {
        toggle: (c: string, on: boolean) => void (on ? classes.add(c) : classes.delete(c)),
        contains: (c: string) => classes.has(c),
      },
    },
  };
  Object.assign(globalThis, {
    window: { localStorage },
    localStorage,
    document: documentStub,
  });
  return { store };
}

import * as storage from "@/lib/storage";

const preset = (overrides: Partial<Preset> = {}): Preset => ({
  id: "p1",
  kind: "Code",
  name: "Coding Flow",
  seedArtists: ["Tycho"],
  energy: 2,
  instrumentalOnly: true,
  sessionLength: 35,
  adventure: 1,
  favourite: true,
  noveltyNudge: 0,
  createdAt: 1,
  ...overrides,
});

const track = (id: string, isNew = true): SessionTrack => ({
  id,
  name: id,
  artist: "Artist",
  albumArt: null,
  spotifyUrl: `https://open.spotify.com/track/${id}`,
  isNew,
  reason: "fits",
});

const session = (overrides: Partial<StoredSession> = {}): StoredSession => ({
  presetId: "p1",
  presetName: "Coding Flow",
  tracks: [track("a", false), track("b")],
  newCount: 1,
  startedAt: 1,
  endedAt: null,
  recapSeen: false,
  ...overrides,
});

let store: Map<string, string>;
beforeEach(() => {
  store = fakeBrowser().store;
});

describe("storage resilience (corrupted / missing state never crashes)", () => {
  it("returns defaults when nothing is stored", () => {
    expect(storage.loadPresets()).toEqual([]);
    expect(storage.getStoredSession()).toBeNull();
    expect(storage.getRecentPreset()).toBeNull();
    expect(storage.getDiscoveries("p1")).toEqual([]);
  });

  it("falls back to defaults on corrupted JSON", () => {
    store.set("flow:v1:presets", "{not json!!");
    store.set("flow:v1:session", "[1,2,");
    expect(storage.loadPresets()).toEqual([]);
    expect(storage.getStoredSession()).toBeNull();
  });

  it("falls back to defaults on valid JSON with the wrong shape", () => {
    store.set("flow:v1:presets", JSON.stringify([{ id: 42, nope: true }]));
    store.set("flow:v1:session", JSON.stringify({ tracks: "not-an-array" }));
    expect(storage.loadPresets()).toEqual([]);
    expect(storage.getStoredSession()).toBeNull();
  });
});

describe("presets", () => {
  it("saves, updates in place, and deletes", () => {
    storage.savePreset(preset());
    storage.savePreset(preset({ name: "Renamed" }));
    expect(storage.loadPresets()).toHaveLength(1);
    expect(storage.getPreset("p1")?.name).toBe("Renamed");

    storage.deletePreset("p1");
    expect(storage.loadPresets()).toEqual([]);
  });

  it("recent preset falls back to newest when the marked one was deleted", () => {
    storage.savePreset(preset({ id: "old", createdAt: 1 }));
    storage.savePreset(preset({ id: "new", createdAt: 2 }));
    storage.setRecentPresetId("gone-preset");
    expect(storage.getRecentPreset()?.id).toBe("new");
  });

  it("clamps the novelty nudge to [-2, 0] and ignores unknown presets", () => {
    storage.savePreset(preset());
    for (let i = 0; i < 10; i++) storage.nudgeNovelty("p1", -0.5);
    expect(storage.getPreset("p1")?.noveltyNudge).toBe(-2);

    storage.nudgeNovelty("p1", 5);
    expect(storage.getPreset("p1")?.noveltyNudge).toBe(0);

    expect(() => storage.nudgeNovelty("ghost", -1)).not.toThrow();
  });
});

describe("discoveries (never lost)", () => {
  it("stores only new tracks, deduped across sessions", () => {
    storage.addDiscoveries("p1", [track("a", false), track("b"), track("c")]);
    storage.addDiscoveries("p1", [track("b"), track("d")]);

    const ids = storage.getDiscoveries("p1").map((t) => t.id);
    expect(ids).toEqual(["b", "c", "d"]);
  });

  it("keeps discoveries per preset", () => {
    storage.addDiscoveries("p1", [track("b")]);
    storage.addDiscoveries("p2", [track("z")]);
    expect(storage.getDiscoveries("p1").map((t) => t.id)).toEqual(["b"]);
    expect(storage.getDiscoveries("p2").map((t) => t.id)).toEqual(["z"]);
  });
});

describe("session lifecycle and the deferred recap", () => {
  it("an unseen session surfaces as a pending recap on re-entry", () => {
    storage.setStoredSession(session());
    expect(storage.getPendingRecap()?.presetId).toBe("p1");
  });

  it("marking the recap seen clears the prompt but keeps the session", () => {
    storage.setStoredSession(session());
    storage.updateStoredSession({ recapSeen: true });
    expect(storage.getPendingRecap()).toBeNull();
    expect(storage.getStoredSession()).not.toBeNull();
  });

  it("clearing removes the session entirely", () => {
    storage.setStoredSession(session());
    storage.clearStoredSession();
    expect(storage.getStoredSession()).toBeNull();
  });
});

describe("reduce-motion preference", () => {
  it("persists and applies the class to the document root", () => {
    storage.setReduceMotion(true);
    expect(storage.getReduceMotion()).toBe(true);
    expect(
      (globalThis as unknown as { document: { documentElement: { classList: { contains: (c: string) => boolean } } } })
        .document.documentElement.classList.contains("reduce-motion"),
    ).toBe(true);
  });
});
