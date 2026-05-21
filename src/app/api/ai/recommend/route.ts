import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { WatchlistItem } from "@/models/WatchlistItem";
import { generateJSON, isGeminiConfigured } from "@/lib/gemini";

interface Recommendation {
  title: string;
  mediaType: "movie" | "tv";
  reason: string;
  matchScore: number;
}

interface RecommendationResponse {
  recommendations: Recommendation[];
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
    const { title, mediaType } = await request.json();

    if (!title || !mediaType) {
      return NextResponse.json({ error: "Missing title or mediaType" }, { status: 400 });
    }

    await connectDB();

    // Fetch all user's watchlist items to avoid recommending things they already have
    const userItems = await WatchlistItem.find({ userId: session.user.id })
      .select("title mediaType status")
      .lean();

    const existingTitles = userItems.map((item) => `${item.title} (${item.mediaType})`);

    const prompt = `
Generate exactly 3 movie/TV recommendations for a user who is currently looking at: "${title}" (${mediaType}).
Avoid recommending any of these items that the user already has in their watchlist:
${JSON.stringify(existingTitles, null, 2)}

Ensure recommendations are relevant, high-quality, and interesting.
The tone of the reasons must be sharp, critical, analytical, and slightly dry (e.g. "Because you appreciated the slow-burn existential dread of X but want a tighter plot"). Avoid bubbly marketing text or emojis.

Provide the response as a JSON object matching this schema:
{
  "recommendations": [
    {
      "title": "Title of the recommended movie/show",
      "mediaType": "movie", // or "tv"
      "reason": "A 1-sentence analytical reason why they should watch this next (max 150 chars)",
      "matchScore": 87 // Matching score percentage (integer from 70 to 99)
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
              reason: { type: "STRING" },
              matchScore: { type: "INTEGER" },
            },
            required: ["title", "mediaType", "reason", "matchScore"],
          },
        },
      },
      required: ["recommendations"],
    };

    const response = await generateJSON<RecommendationResponse>(prompt, schema);
    return NextResponse.json(response);
  } catch (error) {
    console.error("Recommendations API failed:", error);
    return NextResponse.json({ error: "Recommendations generation failed" }, { status: 500 });
  }
}
