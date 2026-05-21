import { NextResponse } from "next/server";
import { searchMulti } from "@/lib/tmdb";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query?.trim()) {
    return NextResponse.json({ results: [] });
  }

  try {
    const data = await searchMulti(query.trim());
    const results = data.results.filter(
      (r) => r.media_type === "movie" || r.media_type === "tv"
    );
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
