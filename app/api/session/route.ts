import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, FRIENDLY } from "@/lib/errors";
import { generateSession } from "@/lib/session/generate";
import { EntryStateSchema, PresetSchema } from "@/lib/types";

const BodySchema = z.object({
  preset: PresetSchema,
  entry: EntryStateSchema.default({ state: "A" }),
  /** Tracks already played this session — endless mode extends past them. */
  exclude: z
    .array(z.object({ title: z.string(), artist: z.string() }))
    .max(200)
    .default([]),
});

/** POST /api/session — generate a real, consistent, novelty-dosed session. */
export async function POST(req: NextRequest) {
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const session = await generateSession(body.preset, body.entry, body.exclude);
    return NextResponse.json(session);
  } catch (err) {
    const apiError = err instanceof ApiError ? err : new ApiError(FRIENDLY.sessionFailed);
    return NextResponse.json({ error: apiError.message }, { status: apiError.status });
  }
}
