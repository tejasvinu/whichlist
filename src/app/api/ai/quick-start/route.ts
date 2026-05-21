import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { WatchlistItem } from "@/models/WatchlistItem";
import { generateJSON, isGeminiConfigured } from "@/lib/gemini";
import { searchMulti, posterUrl, getTitle, getReleaseYear } from "@/lib/tmdb";

interface GeminiRecommendation {
  title: string;
  mediaType: "movie" | "tv";
  releaseYear: number;
  reason: string;
}

interface GeminiResponse {
  recommendations: GeminiRecommendation[];
}

export async function POST() {
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
    await connectDB();

    // Fetch ALL items — including not-interested and unwatched — for full AI context
    const allItems = await WatchlistItem.find({ userId: session.user.id })
      .select("title mediaType status rating review tags")
      .lean();

    const notInterestedItems = allItems.filter((item) =>
      item.tags?.includes("not-interested")
    );
    const unwatchedItems = allItems.filter(
      (item) => item.status === "Plan to Watch" && !item.tags?.includes("not-interested")
    );
    const watchedItems = allItems.filter(
      (item) => item.status !== "Plan to Watch" && !item.tags?.includes("not-interested")
    );
    const existingTitles = allItems.map((item) => `${item.title} (${item.mediaType})`);

    const hasContext = allItems.length > 0;

    const prompt = `
Generate exactly 10 movie or TV show recommendations for a user.
${
  !hasContext
    ? `The user's watchlist is currently empty. Provide a highly curated, diverse starter pack of 10 classic or critically-acclaimed movies and TV shows across different genres, eras (e.g. 1970s to 2020s), and countries to help them build their profile.`
    : `The user has the following viewing history and preferences. Use ALL of this context.

${watchedItems.length > 0 ? `WATCHED/RATED (strongest taste signals):
${JSON.stringify(watchedItems, null, 2)}` : ""}

${unwatchedItems.length > 0 ? `PLAN TO WATCH (secondary interest signals):
${JSON.stringify(unwatchedItems.map((i) => ({ title: i.title, mediaType: i.mediaType })), null, 2)}` : ""}

${notInterestedItems.length > 0 ? `NOT INTERESTED (explicitly rejected — do NOT recommend anything similar):
${JSON.stringify(notInterestedItems.map((i) => ({ title: i.title, mediaType: i.mediaType })), null, 2)}` : ""}

Provide exactly 10 new recommendations NOT already in this list:
${JSON.stringify(existingTitles, null, 2)}

Align with taste signals from watched items. Actively avoid the genres, tones, or styles of not-interested items.`
}

The tone of the reasons must be sharp, critical, analytical, and slightly dry. Avoid bubbly marketing language or emojis.
Keep the reason concise (maximum 150 characters).

Provide the response as a JSON object matching this schema:
{
  "recommendations": [
    {
      "title": "Title of recommended movie/show",
      "mediaType": "movie",
      "releaseYear": 2010,
      "reason": "Brief 1-sentence analytical reason."
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
              releaseYear: { type: "INTEGER" },
              reason: { type: "STRING" },
            },
            required: ["title", "mediaType", "releaseYear", "reason"],
          },
        },
      },
      required: ["recommendations"],
    };

    const response = await generateJSON<GeminiResponse>(prompt, schema);
    const recommendations = response.recommendations ?? [];

    // Enrich recommendations with TMDB poster paths and correct IDs in parallel
    const enrichedRecommendations = await Promise.all(
      recommendations.map(async (rec) => {
        try {
          const searchRes = await searchMulti(rec.title);
          const results = searchRes.results ?? [];

          // Find the closest match: matching mediaType, and matching or close to releaseYear
          let bestMatch = results.find(
            (item) =>
              item.media_type === rec.mediaType &&
              getReleaseYear(item) === rec.releaseYear
          );

          // If no exact match on year, match on mediaType
          if (!bestMatch) {
            bestMatch = results.find((item) => item.media_type === rec.mediaType);
          }

          // If still no match, fallback to the first result that is not a person
          if (!bestMatch) {
            bestMatch = results.find((item) => item.media_type !== "person");
          }

          // If still nothing, fallback to first result
          if (!bestMatch && results.length > 0) {
            bestMatch = results[0];
          }

          if (bestMatch) {
            return {
              tmdbId: bestMatch.id,
              title: getTitle(bestMatch),
              mediaType: (bestMatch.media_type === "tv" ? "tv" : "movie") as "movie" | "tv",
              posterPath: posterUrl(bestMatch.poster_path, "w342"),
              releaseYear: getReleaseYear(bestMatch) ?? rec.releaseYear,
              reason: rec.reason,
            };
          }
        } catch (e) {
          console.error(`Failed to enrich recommendation for: ${rec.title}`, e);
        }
        // Fallback if search fails or finds nothing
        return {
          tmdbId: Math.floor(Math.random() * 100000), // fake ID
          title: rec.title,
          mediaType: rec.mediaType,
          posterPath: null,
          releaseYear: rec.releaseYear,
          reason: rec.reason,
        };
      })
    );

    return NextResponse.json({ recommendations: enrichedRecommendations });
  } catch (error) {
    console.error("Quick Start recommendations failed:", error);
    return NextResponse.json(
      { error: "Failed to generate quick-start recommendations" },
      { status: 500 }
    );
  }
}
