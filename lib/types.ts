import { z } from "zod";
import type { ResolvedTrack } from "@/lib/spotify/search";

/** Preset kinds shown at setup; users can hold several presets. */
export const PRESET_KINDS = ["Study", "Work", "Code", "Read"] as const;
export type PresetKind = (typeof PRESET_KINDS)[number];

export const PresetSchema = z.object({
  id: z.string(),
  kind: z.enum(PRESET_KINDS),
  name: z.string(),
  seedArtists: z.array(z.string()),
  /** 1 (calm) – 5 (energetic); steady within a session either way. */
  energy: z.number().min(1).max(5),
  instrumentalOnly: z.boolean(),
  /** Minutes. */
  sessionLength: z.number().min(10).max(180),
  /** 0 (no novelty) – 3 (adventurous). Defaults LOW. */
  adventure: z.number().min(0).max(3),
  favourite: z.boolean(),
  /**
   * Learning signal: skips on new tracks nudge this down (min -2), successful
   * sessions drift it back to 0. Applied on top of `adventure`.
   */
  noveltyNudge: z.number().min(-2).max(0),
  createdAt: z.number(),
});
export type Preset = z.infer<typeof PresetSchema>;

/** How the session was entered — changes how generation opens. */
export const EntryStateSchema = z.discriminatedUnion("state", [
  // A: nothing playing — fresh start from preset taste
  z.object({ state: z.literal("A") }),
  // B: something already playing — ease toward the preset over 1–2 tracks
  z.object({
    state: z.literal("B"),
    anchor: z.object({ title: z.string(), artist: z.string() }),
  }),
  // C: "start a Flow from this song" — the anchor is a strong, intentional seed
  z.object({
    state: z.literal("C"),
    anchor: z.object({ title: z.string(), artist: z.string() }),
  }),
]);
export type EntryState = z.infer<typeof EntryStateSchema>;

/** A track in a generated session: resolved via Spotify + Flow metadata. */
export type SessionTrack = ResolvedTrack & {
  isNew: boolean;
  reason: string;
};

export type GeneratedSession = {
  tracks: SessionTrack[];
  newCount: number;
};

/** Shape the LLM must return (validated with zod; free-form text rejected). */
export const LlmTrackSchema = z.object({
  title: z.string().min(1),
  artist: z.string().min(1),
  is_new: z.boolean(),
  reason: z.string(),
});
export type LlmTrack = z.infer<typeof LlmTrackSchema>;

export const LlmSessionSchema = z.object({
  tracks: z.array(LlmTrackSchema).min(1),
  backfill: z.array(LlmTrackSchema),
});
export type LlmSession = z.infer<typeof LlmSessionSchema>;
