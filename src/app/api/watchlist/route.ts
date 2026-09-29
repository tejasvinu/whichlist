import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { WatchlistItem } from "@/models/WatchlistItem";
import { SharedUniverse, ISharedUniverse } from "@/models/SharedUniverse";
import { UserUniverse } from "@/models/UserUniverse";
import { WATCH_STATUSES, MEDIA_TYPES } from "@/lib/constants";
import { upsertWatchlistItem } from "@/lib/watchlist";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const mediaType = searchParams.get("mediaType");
  const status = searchParams.get("status");
  const tag = searchParams.get("tag");
  const sort = searchParams.get("sort") ?? "dateAdded";
  const showNotInterested = searchParams.get("showNotInterested") === "true";
  const isExport = searchParams.get("export") === "true";

  await connectDB();

  // 1. Fetch watchlist items (movies / tv shows)
  let watchlistItems: any[] = [];
  const fetchWatchlist = !mediaType || mediaType === "movie" || mediaType === "tv";

  if (fetchWatchlist) {
    const filter: Record<string, unknown> = { userId: session.user.id };
    if (!isExport) {
      if (mediaType === "movie" || mediaType === "tv") {
        filter.mediaType = mediaType;
      }
      if (status && WATCH_STATUSES.includes(status as (typeof WATCH_STATUSES)[number])) {
        filter.status = status;
      }
      if (tag) {
        filter.tags = tag;
      } else if (!showNotInterested) {
        filter.tags = { $ne: "not-interested" };
      }
    }

    let sortQuery: Record<string, 1 | -1> = { dateAdded: -1 };
    if (!isExport) {
      if (sort === "rating") sortQuery = { rating: -1, dateAdded: -1 };
      if (sort === "releaseYear") sortQuery = { releaseYear: -1, dateAdded: -1 };
    }

    watchlistItems = await WatchlistItem.find(filter).sort(sortQuery).lean();
  }

  // 2. Fetch rated universes
  let universeItems: any[] = [];
  const fetchUniverses = !mediaType || mediaType === "universe";

  if (fetchUniverses && (!tag || tag === "universe")) {
    const uFilter: Record<string, unknown> = { userId: session.user.id };
    if (status && WATCH_STATUSES.includes(status as (typeof WATCH_STATUSES)[number])) {
      uFilter.status = status;
    }
    const userUniverses = await UserUniverse.find(uFilter).lean();
    const populated = await Promise.all(
      userUniverses.map(async (uu) => {
        const shared = (await SharedUniverse.findById(uu.universeId).lean()) as ISharedUniverse | null;
        if (!shared) return null;

        const firstWithPoster = shared.items.find((item) => item.posterPath);
        const posterPath = firstWithPoster ? firstWithPoster.posterPath : null;

        const releaseYear = shared.items.length
          ? Math.min(...shared.items.map((i) => i.releaseYear || Infinity).filter((y) => y !== Infinity))
          : null;

        return {
          _id: uu._id.toString(),
          userId: uu.userId.toString(),
          tmdbId: 0,
          mediaType: "universe" as const,
          title: shared.name,
          slug: shared.slug,
          posterPath,
          releaseYear: releaseYear === Infinity ? null : releaseYear,
          status: uu.status,
          rating: uu.rating,
          review: uu.review,
          tags: ["universe"],
          dateAdded: uu.createdAt,
          createdAt: uu.createdAt,
          updatedAt: uu.updatedAt,
        };
      })
    );
    universeItems = populated.filter(Boolean);
  }

  // 3. Combine and sort
  const combined = [...watchlistItems, ...universeItems];

  if (sort === "rating") {
    combined.sort((a, b) => {
      const rA = a.rating ?? -1;
      const rB = b.rating ?? -1;
      if (rB !== rA) return rB - rA;
      return new Date(b.dateAdded || b.createdAt).getTime() - new Date(a.dateAdded || a.createdAt).getTime();
    });
  } else if (sort === "releaseYear") {
    combined.sort((a, b) => {
      const yA = a.releaseYear ?? -1;
      const yB = b.releaseYear ?? -1;
      if (yB !== yA) return yB - yA;
      return new Date(b.dateAdded || b.createdAt).getTime() - new Date(a.dateAdded || a.createdAt).getTime();
    });
  } else {
    combined.sort((a, b) => {
      return new Date(b.dateAdded || b.createdAt).getTime() - new Date(a.dateAdded || a.createdAt).getTime();
    });
  }

  return NextResponse.json({ items: combined });
}


export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { tmdbId, mediaType, title, posterPath, releaseYear, status, rating, review, tags } =
      body;

    if (!tmdbId || !mediaType || !title) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!MEDIA_TYPES.includes(mediaType)) {
      return NextResponse.json({ error: "Invalid media type" }, { status: 400 });
    }

    if (status && !WATCH_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    if (rating != null && (rating < 1 || rating > 10)) {
      return NextResponse.json({ error: "Rating must be 1-10" }, { status: 400 });
    }

    await connectDB();

    const { item } = await upsertWatchlistItem({
      userId: session.user.id,
      tmdbId,
      mediaType,
      title,
      posterPath: posterPath ?? null,
      releaseYear: releaseYear ?? null,
      status: status ?? "Plan to Watch",
      rating: rating ?? undefined,
      review: review ?? undefined,
      tags: tags ?? [],
      mergeTags: false,
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === 11000) {
      return NextResponse.json({ error: "Already in watchlist" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to add item" }, { status: 500 });
  }
}
