import { NextRequest, NextResponse } from "next/server";
import { ApiError, FRIENDLY } from "@/lib/errors";
import { searchTracksList } from "@/lib/spotify/search";

/** GET /api/search?q=… — free-text track search for the Search screen. */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length === 0 || q.length > 100) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const tracks = await searchTracksList(q);
    return NextResponse.json({ tracks });
  } catch (err) {
    const apiError = err instanceof ApiError ? err : new ApiError(FRIENDLY.spotifyDown);
    return NextResponse.json({ error: apiError.message }, { status: apiError.status });
  }
}
