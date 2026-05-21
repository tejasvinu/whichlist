import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateJSON, isGeminiConfigured } from "@/lib/gemini";
import { searchMulti } from "@/lib/tmdb";

interface VibeRecommendation {
  title: string;
  mediaType: "movie" | "tv";
  matchReason: string;
  relevanceScore: number;
}

interface VibeSearchResult {
  recommendations: VibeRecommendation[];
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isGeminiConfigured()) {
    return NextResponse.json(
      { error: "Gemini is not configured. Please add GEMINI_API_KEY to your .env.local." },
      { status: 400 }
    );
  }

  try {
    const { query } = await request.json();
    if (!query?.trim()) {
      return NextResponse.json({ results: [] });
    }

    const prompt = `
Generate exactly 6 to 8 real, well-known movies or TV shows that perfectly match the following vibe, theme, or mood: "${query}".

The tone of the match reasons must be sharp, analytical, and slightly dry (e.g. "A classic of cozy winter melancholy that captures the isolation of the landscape"). Avoid marketing fluff and emojis.

Provide the response as a JSON object matching this schema:
{
  "recommendations": [
    {
      "title": "Exact official title of the movie/show",
      "mediaType": "movie", // or "tv"
      "matchReason": "A 1-sentence analytical explanation of why this fits the vibe (max 150 chars)",
      "relevanceScore": 9 // Relevance score from 1 to 10 matching this vibe
    }
  ]
}
`;

    const schema = {
      type: "OBJECT",
      properties: {
        recommendations: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING" },
              mediaType: { type: "STRING", enum: ["movie", "tv"] },
              matchReason: { type: "STRING" },
              relevanceScore: { type: "INTEGER" },
            },
            required: ["title", "mediaType", "matchReason", "relevanceScore"],
          },
        },
      },
      required: ["recommendations"],
    };

    const response = await generateJSON<VibeSearchResult>(prompt, schema);
    
    // Query TMDB in parallel for each recommendation to resolve it to actual TMDB data
    const searchPromises = (response.recommendations || []).map(async (rec) => {
      try {
        const searchRes = await searchMulti(rec.title);
        
        // Find the first result matching the type, or fallback to first result
        const match = searchRes.results?.find(
          (item) => item.media_type === rec.mediaType
        ) || searchRes.results?.[0];

        if (!match) return null;

        return {
          tmdbId: match.id,
          mediaType: (match.media_type || rec.mediaType) as "movie" | "tv",
          title: match.title ?? match.name ?? rec.title,
          posterPath: match.poster_path ? `https://image.tmdb.org/t/p/w500${match.poster_path}` : null,
          matchReason: rec.matchReason,
          relevanceScore: rec.relevanceScore,
        };
      } catch (err) {
        console.error(`TMDB search failed for recommended title "${rec.title}":`, err);
        return null;
      }
    });

    const resolved = await Promise.all(searchPromises);
    const results = resolved
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Vibe search API failed:", error);
    return NextResponse.json({ error: "Vibe search failed" }, { status: 500 });
  }
}
