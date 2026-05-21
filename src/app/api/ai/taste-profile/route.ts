import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { WatchlistItem } from "@/models/WatchlistItem";
import { TasteProfile } from "@/models/TasteProfile";
import { generateJSON, isGeminiConfigured } from "@/lib/gemini";

interface TasteProfileResponse {
  headline: string;
  roast: string;
  archetype: string;
  topPatterns: string[];
  blindSpot: string;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let regenerate = false;
  try {
    const body = await request.json();
    regenerate = body?.regenerate === true;
  } catch (e) {
    // Body is empty or invalid JSON, defaults to regenerate = false
  }

  try {
    await connectDB();

    const items = await WatchlistItem.find({ userId: session.user.id }).lean();

    if (items.length === 0) {
      return NextResponse.json({
        headline: "EMPTY LIST DETECTED",
        roast: "LIST UNDER-UTILIZED. TRACK MORE TELEMETRY LOGS TO REVEAL TASTE PROFILE.",
        archetype: "The Blank Slate",
        topPatterns: ["No logs recorded", "Zero data points"],
        blindSpot: "Everything is currently a blind spot. Add items to initialize.",
      });
    }

    // Check cache if regenerate is false
    if (!regenerate) {
      const cachedProfile = await TasteProfile.findOne({ userId: session.user.id }).lean();
      if (cachedProfile) {
        return NextResponse.json({
          headline: cachedProfile.headline,
          roast: cachedProfile.roast,
          archetype: cachedProfile.archetype,
          topPatterns: cachedProfile.topPatterns,
          blindSpot: cachedProfile.blindSpot,
        });
      }
    }

    if (!isGeminiConfigured()) {
      return NextResponse.json(
        { error: "Gemini is not configured. Please add GEMINI_API_KEY to your .env.local." },
        { status: 400 }
      );
    }

    const watchlistData = items.map((item) => ({
      title: item.title,
      mediaType: item.mediaType,
      status: item.status,
      rating: item.rating ?? "unrated",
      review: item.review ?? "",
      tags: (item as any).tags ?? [],
    }));

    const prompt = `
Analyze the user's movie/TV watchlist data to generate a dynamic, highly personalized taste profile and diagnostic roast.
The tone must be sharp, analytical, minimalist, and slightly sardonic (an honest critic system, not an overly positive assistant). Avoid emojis.

Here is the user's watchlist data:
${JSON.stringify(watchlistData, null, 2)}

Provide the response as a JSON object matching this schema:
{
  "headline": "A short, punchy 3-4 word all-caps title summarizing their taste archetype",
  "roast": "A 1-2 sentence witty, slightly sardonic diagnostic roast of their taste patterns, rating habits, or commitment issues (max 200 chars)",
  "archetype": "A brief, stylized title for their movie personality (e.g. 'Nostalgia Purist')",
  "topPatterns": ["Pattern 1", "Pattern 2", "Pattern 3"], // Exactly 3 key observations, max 60 chars each
  "blindSpot": "A witty sentence pointing out a key genre, era, or type of cinema they are ignoring based on their list"
}
`;

    const schema = {
      type: "OBJECT",
      properties: {
        headline: { type: "STRING" },
        roast: { type: "STRING" },
        archetype: { type: "STRING" },
        topPatterns: {
          type: "ARRAY",
          items: { type: "STRING" },
        },
        blindSpot: { type: "STRING" },
      },
      required: ["headline", "roast", "archetype", "topPatterns", "blindSpot"],
    };

    const response = await generateJSON<TasteProfileResponse>(prompt, schema);

    // Save/update cache in database
    await TasteProfile.findOneAndUpdate(
      { userId: session.user.id },
      {
        userId: session.user.id,
        headline: response.headline,
        roast: response.roast,
        archetype: response.archetype,
        topPatterns: response.topPatterns,
        blindSpot: response.blindSpot,
      },
      { upsert: true, new: true }
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error("Taste profile API failed:", error);
    return NextResponse.json({ error: "Taste profile generation failed" }, { status: 500 });
  }
}
