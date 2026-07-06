import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, FRIENDLY } from "@/lib/errors";
import { isSaveConfigured } from "@/lib/env";
import { saveToSharedPlaylist } from "@/lib/spotify/playlist";

const BodySchema = z.object({
  trackIds: z.array(z.string().min(1)).max(100),
});

/**
 * POST /api/save — add discoveries to the shared "Flow Discoveries" playlist
 * (acting as the owner; no visitor login). Deduped server-side.
 */
export async function POST(req: NextRequest) {
  if (!isSaveConfigured) {
    return NextResponse.json({ error: FRIENDLY.notConfigured }, { status: 503 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const result = await saveToSharedPlaylist(body.trackIds);
    return NextResponse.json(result);
  } catch (err) {
    const apiError = err instanceof ApiError ? err : new ApiError(FRIENDLY.saveFailed);
    return NextResponse.json({ error: apiError.message }, { status: apiError.status });
  }
}
