import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateJSON, isGeminiConfigured } from "@/lib/gemini";

interface AutoTagResponse {
  tags: string[];
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
    const { title, mediaType, review } = await request.json();

    if (!review?.trim()) {
      return NextResponse.json({ tags: [] });
    }

    const prompt = `
The user has logged the following review for the ${mediaType} titled "${title}":
"${review}"

Analyze this review, synopsis-clues, and the tone to generate 3 to 5 highly relevant, sortable mood/style/theme tags.
Keep tags short (1-3 words), descriptive, and normalized to Title Case (e.g. "Slow Burn", "Mind-Bending", "Tearjerker", "Visually Stunning", "Cerebral", "Feel-Good", "Dark Humor").
Avoid generic tags like "Good", "Bad", "TV Show", "Movie", or the title of the item itself.

Provide the response as a JSON object matching this schema:
{
  "tags": ["Tag 1", "Tag 2", "Tag 3"]
}
`;

    const schema = {
      type: "OBJECT",
      properties: {
        tags: {
          type: "ARRAY",
          items: { type: "STRING" },
        },
      },
      required: ["tags"],
    };

    const response = await generateJSON<AutoTagResponse>(prompt, schema);
    return NextResponse.json({ tags: response.tags });
  } catch (error) {
    console.error("Auto tag API failed:", error);
    return NextResponse.json({ error: "Auto tag failed" }, { status: 500 });
  }
}
