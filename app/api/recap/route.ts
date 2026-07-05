import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { groqJson } from "@/lib/groq/client";
import { buildRecapMessages, RECAP_FALLBACK } from "@/lib/groq/prompts";

const BodySchema = z.object({
  presetName: z.string().min(1),
  newTracks: z.array(z.object({ name: z.string(), artist: z.string() })),
});

const RecapSchema = z.object({ headline: z.string().min(1) });

/**
 * POST /api/recap — one calm recap line. The recap must never block the
 * flow, so any LLM failure falls back to a template.
 */
export async function POST(req: NextRequest) {
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const fallback = RECAP_FALLBACK(body.presetName, body.newTracks.length);
  if (body.newTracks.length === 0) {
    return NextResponse.json({ headline: fallback });
  }

  try {
    const recap = await groqJson(
      RecapSchema,
      buildRecapMessages(body.presetName, body.newTracks),
      0.8,
    );
    return NextResponse.json({ headline: recap.headline });
  } catch {
    return NextResponse.json({ headline: fallback });
  }
}
