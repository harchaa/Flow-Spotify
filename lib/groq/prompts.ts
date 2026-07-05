import type { ChatMessage } from "@/lib/groq/client";
import type { EntryState, Preset } from "@/lib/types";

const ENERGY_WORDS = ["very calm", "calm", "moderate", "upbeat", "energetic"];

/**
 * Builds the single session-generation call. The LLM does taste + consistency;
 * exact novelty count and placement are enforced afterwards in code.
 */
export function buildSessionMessages(
  preset: Preset,
  entry: EntryState,
  trackCount: number,
  newCount: number,
): ChatMessage[] {
  const energyWord = ENERGY_WORDS[Math.round(preset.energy) - 1] ?? "moderate";
  const seeds = preset.seedArtists.filter(Boolean);
  // Generous alternates: the LLM occasionally names unfindable tracks, and
  // spares also top up the novelty dose — 50% headroom keeps sessions full.
  const backfillCount = Math.max(4, Math.ceil(trackCount * 0.5));

  const system = `You are Flow, a focus-music curator inside Spotify. You build listening sessions for people doing cognitively demanding work (coding, studying, reading). The one unbreakable rule: the session must be sonically CONSISTENT — steady energy, steady tempo, no jarring transitions, nothing startling. Unfamiliar or unpredictable music breaks concentration.

Respond with ONLY a JSON object in this exact shape:
{"tracks":[{"title":"...","artist":"...","is_new":false,"reason":"..."}],"backfill":[{"title":"...","artist":"...","is_new":false,"reason":"..."}]}

Rules:
- Every track must be a REAL, findable-on-Spotify track. Prefer well-known catalog over obscure remixes so search can resolve them. Never invent titles.
- "is_new": false = squarely in the listener's stated taste (their seed artists or very close). true = a DISCOVERY: an artist outside their seeds, but sonically so close it will not break focus.
- Exactly the requested number of tracks marked is_new=true in "tracks". Discoveries must be sonically indistinguishable in energy/mood from the rest.
- "reason": one short line (max 12 words) explaining why the track fits this session. For discoveries, mention the taste link (e.g. "Close to Tycho's mellow pulse").
- "backfill": extra alternates in the same vibe used to replace tracks that can't be found. Same consistency bar. Include at least 2 with is_new=true and the rest is_new=false.
- No two tracks by the same artist back-to-back. No duplicate tracks.`;

  const lines = [
    `Build a ${trackCount}-track focus session, plus ${backfillCount} backfill alternates.`,
    `Preset: "${preset.name}" (${preset.kind.toLowerCase()} session).`,
    seeds.length > 0
      ? `The listener focuses to: ${seeds.join(", ")}. Anchor the sound to these.`
      : `The listener has not named artists yet (cold start): open with safe, widely loved tracks that fit the vibe, and keep any discoveries extra familiar-sounding.`,
    `Energy: ${energyWord}, held steady for the whole session.`,
    preset.instrumentalOnly
      ? `Instrumental only — but consistency outranks this: if a perfect-fit track has faint vocals, prefer keeping the vibe over strict instrumentality.`
      : `Vocals are fine as long as the energy stays steady.`,
    `Mark exactly ${newCount} of the ${trackCount} tracks as is_new=true.`,
  ];

  if (entry.state === "B") {
    lines.push(
      `The listener was already playing "${entry.anchor.title}" by ${entry.anchor.artist}. Treat it as a light taste hint: let the first 1-2 tracks ease from its sound toward the preset's consistent vibe, then the preset fully takes over. Do NOT include that exact track.`,
    );
  } else if (entry.state === "C") {
    lines.push(
      `The listener chose to start this Flow from "${entry.anchor.title}" by ${entry.anchor.artist}. Treat it as a STRONG anchor: the session's sound should grow out of that track, blended with the preset taste. Do NOT include that exact track.`,
    );
  } else {
    lines.push(`Start fresh from the preset's taste.`);
  }

  return [
    { role: "system", content: system },
    { role: "user", content: lines.join("\n") },
  ];
}

export const RECAP_FALLBACK = (presetName: string, newCount: number) =>
  newCount === 0
    ? `Your last ${presetName} session stayed all-familiar. Nothing new to review.`
    : `Last ${presetName}: ${newCount} new ${newCount === 1 ? "song" : "songs"} slipped in. Keep any?`;

/** One quiet recap line, written by the LLM (template fallback if it fails). */
export function buildRecapMessages(
  presetName: string,
  newTracks: { name: string; artist: string }[],
): ChatMessage[] {
  return [
    {
      role: "system",
      content: `You write one short, calm recap line for Flow, a focus-music feature. Tone: quiet, friendly, zero hype, no exclamation marks. Respond with ONLY JSON: {"headline":"..."}. Max 14 words.`,
    },
    {
      role: "user",
      content: `The listener just finished a "${presetName}" focus session. ${newTracks.length} new ${newTracks.length === 1 ? "track" : "tracks"} were quietly added: ${newTracks.map((t) => `"${t.name}" by ${t.artist}`).join(", ")}. Write the recap headline inviting them to review the discoveries.`,
    },
  ];
}
