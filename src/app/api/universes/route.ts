import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { SharedUniverse } from "@/models/SharedUniverse";
import { UserUniverse } from "@/models/UserUniverse";
import { auth } from "@/lib/auth";
import { generateJSON } from "@/lib/gemini";
import { searchMulti } from "@/lib/tmdb";

// Helper to generate a slug
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function GET(request: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    let filter = {};
    if (query) {
      filter = { name: { $regex: query, $options: "i" } };
    }

    const universes = await SharedUniverse.find(filter).sort({ name: 1 }).lean();

    // Fetch rating aggregates for each universe
    const universesWithStats = await Promise.all(
      universes.map(async (u) => {
        const ratings = await UserUniverse.find({ universeId: u._id, rating: { $exists: true } }).select("rating").lean();
        const avgRating = ratings.length
          ? parseFloat((ratings.reduce((acc, curr) => acc + (curr.rating || 0), 0) / ratings.length).toFixed(1))
          : null;
        
        return {
          ...u,
          avgRating,
          ratingCount: ratings.length,
        };
      })
    );

    return NextResponse.json({ universes: universesWithStats });
  } catch (err) {
    console.error("Failed to fetch universes:", err);
    return NextResponse.json({ error: "Failed to fetch universes" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name } = await request.json();
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Universe name is required" }, { status: 400 });
    }

    const slug = generateSlug(name);
    await connectDB();

    // Check if it already exists
    const existing = await SharedUniverse.findOne({ slug });
    if (existing) {
      return NextResponse.json({ universe: existing, cached: true }, { status: 200 });
    }

    // Call Gemini to generate the universe details
    const prompt = `
    Generate a structured cinematic universe profile for "${name.trim()}".
    Identify the official cinematic universe (e.g. if the user says "MCU" or "marvel", map it to "Marvel Cinematic Universe").
    Provide a list of all movies and/or major television shows that belong in this franchise's official/canon watch list, sorted by release date/year.
    Include:
    - Official name of the universe.
    - A concise, high-level description summarizing the universe's theme and scope.
    - An array of items containing "title", "releaseYear" (integer), and "mediaType" ("movie" or "tv").
    
    Make sure to only include official releases. Limit the number of list items to a maximum of 40 of the most significant releases if the universe is exceptionally large, to keep response sizes reasonable.
    `;

    const responseSchema = {
      type: "OBJECT",
      properties: {
        name: { type: "STRING" },
        description: { type: "STRING" },
        items: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING" },
              releaseYear: { type: "INTEGER" },
              mediaType: { type: "STRING", enum: ["movie", "tv"] }
            },
            required: ["title", "releaseYear", "mediaType"]
          }
        }
      },
      required: ["name", "description", "items"]
    };

    interface AiGeneratedUniverse {
      name: string;
      description: string;
      items: {
        title: string;
        releaseYear: number;
        mediaType: "movie" | "tv";
      }[];
    }

    const generated = await generateJSON<AiGeneratedUniverse>(prompt, responseSchema);

    // Resolve TMDB details for each item to fetch correct IDs and posters
    const resolvedItems = [];
    for (const item of generated.items) {
      let tmdbId: number | null = null;
      let posterPath: string | null = null;
      let title = item.title;
      let releaseYear = item.releaseYear;

      try {
        const searchRes = await searchMulti(item.title);
        if (searchRes?.results?.length) {
          // Look for matching media_type and close release year
          const match = searchRes.results.find((res) => {
            const typeMatch = res.media_type === item.mediaType;
            const dateStr = res.release_date || res.first_air_date;
            const resYear = dateStr ? new Date(dateStr).getFullYear() : null;
            const yearMatch = resYear ? Math.abs(resYear - item.releaseYear) <= 1 : true;
            return typeMatch && yearMatch;
          }) || searchRes.results[0];

          if (match) {
            tmdbId = match.id;
            posterPath = match.poster_path ? `https://image.tmdb.org/t/p/w500${match.poster_path}` : null;
            title = match.title ?? match.name ?? item.title;
            const matchDateStr = match.release_date || match.first_air_date;
            if (matchDateStr) {
              releaseYear = new Date(matchDateStr).getFullYear();
            }
          }        }
      } catch (err) {
        console.error(`Failed to resolve TMDB data for item: ${item.title}`, err);
      }

      // If we couldn't resolve tmdbId, we skip it to prevent broken UI
      if (tmdbId !== null) {
        resolvedItems.push({
          tmdbId,
          mediaType: item.mediaType,
          title,
          posterPath,
          releaseYear,
        });
      }
    }

    // Save generated universe
    const newUniverse = await SharedUniverse.create({
      name: generated.name,
      slug: generateSlug(generated.name),
      description: generated.description,
      items: resolvedItems,
    });

    return NextResponse.json({ universe: newUniverse, cached: false }, { status: 201 });
  } catch (err) {
    console.error("Failed to generate universe:", err);
    return NextResponse.json({ error: "Failed to generate cinematic universe via AI" }, { status: 500 });
  }
}
