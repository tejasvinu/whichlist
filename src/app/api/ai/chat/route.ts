import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { WatchlistItem } from "@/models/WatchlistItem";
import { generateText, isGeminiConfigured } from "@/lib/gemini";

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
    const { message, history } = await request.json();

    if (!message) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    await connectDB();

    // Fetch user items to feed to the chatbot as library context
    const items = await WatchlistItem.find({ userId: session.user.id })
      .select("title mediaType status rating review tags")
      .lean();

    const libraryContext = items.map((item) => ({
      title: item.title,
      mediaType: item.mediaType,
      status: item.status,
      rating: item.rating ?? "unrated",
      review: item.review ?? "",
      tags: (item as any).tags ?? [],
    }));

    const systemInstruction = `
You are the "whichlist Assistant", the AI for "whichlist". 
You are a highly analytical, witty, and slightly sardonic cinematic critic system.
Your voice is minimalist, dry, and direct. Avoid emojis, overly enthusiastic greetings, or exclamation marks. Keep replies brief (max 2-3 short paragraphs).
You have access to the user's watchlist catalog and reviews. Use this context to answer questions, recommend films, debate ratings, and roast their choices if appropriate.
`;

    const formattedHistory = (history ?? [])
      .map((msg: { role: "user" | "assistant"; content: string }) => {
        const label = msg.role === "user" ? "USER" : "ASSISTANT";
        return `${label}: ${msg.content}`;
      })
      .join("\n");

    const prompt = `
USER'S WATCHLIST CATALOG CONTEXT:
${JSON.stringify(libraryContext, null, 2)}

CHAT HISTORY:
${formattedHistory}
USER: ${message}

ASSISTANT:
`;

    const reply = await generateText(prompt, systemInstruction);
    return NextResponse.json({ reply });
  } catch (error) {
    console.error("AI Chat API failed:", error);
    return NextResponse.json({ error: "Chat failed" }, { status: 500 });
  }
}
