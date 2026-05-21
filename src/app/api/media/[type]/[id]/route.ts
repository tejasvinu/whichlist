import { NextResponse } from "next/server";
import { getMovieDetails, getTvDetails } from "@/lib/tmdb";
import type { MediaType } from "@/lib/constants";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const { type, id } = await params;

  if (type !== "movie" && type !== "tv") {
    return NextResponse.json({ error: "Invalid media type" }, { status: 400 });
  }

  const tmdbId = parseInt(id, 10);
  if (isNaN(tmdbId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    const details =
      (type as MediaType) === "movie"
        ? await getMovieDetails(tmdbId)
        : await getTvDetails(tmdbId);
    return NextResponse.json({ type, details });
  } catch {
    return NextResponse.json({ error: "Failed to fetch media" }, { status: 500 });
  }
}
