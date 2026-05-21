import { NextResponse } from "next/server";
import { getTrending } from "@/lib/tmdb";

export async function GET() {
  try {
    const data = await getTrending();
    const results = data.results.filter(
      (r) => r.media_type === "movie" || r.media_type === "tv"
    );
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "Failed to fetch trending" }, { status: 500 });
  }
}
