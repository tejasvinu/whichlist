import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { SwipeEvent, SwipeAction } from "@/models/SwipeEvent";
import { WatchlistItem, IWatchlistItem } from "@/models/WatchlistItem";
import { upsertWatchlistItem } from "@/lib/watchlist";
import { MEDIA_TYPES } from "@/lib/constants";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { tmdbId, mediaType, action, position, source, itemSnapshot } = body;

    if (!tmdbId || !mediaType || !action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!MEDIA_TYPES.includes(mediaType)) {
      return NextResponse.json({ error: "Invalid media type" }, { status: 400 });
    }

    const validActions: SwipeAction[] = ["pass", "like", "watched", "never"];
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: "Invalid swipe action" }, { status: 400 });
    }

    await connectDB();
    const userId = session.user.id;

    // 1. Fetch existing WatchlistItem doc to preserve for undo snapshot
    const prevItem = await WatchlistItem.findOne({
      userId,
      tmdbId,
      mediaType,
    }).lean<IWatchlistItem | null>();

    // 2. Perform watchlist update for like, watched, never
    const title = itemSnapshot?.title || "Untitled";
    const posterPath = itemSnapshot?.posterPath ?? null;
    const releaseYear = itemSnapshot?.releaseYear ?? null;
    const userRating =
      typeof body.rating === "number"
        ? body.rating
        : body.rating
        ? parseInt(body.rating, 10)
        : undefined;
    const userReview = typeof body.review === "string" ? body.review : undefined;
    const customTags = Array.isArray(body.tags) ? body.tags : [];
    const targetStatus = body.status || "Completed";

    if (action === "like") {
      // Re-activating: clear any "not-interested" tag
      const existingTags = (prevItem?.tags || []).filter((t) => t !== "not-interested");
      await upsertWatchlistItem({
        userId,
        tmdbId,
        mediaType,
        title,
        posterPath,
        releaseYear,
        status: "Plan to Watch",
        tags: existingTags,
        mergeTags: false,
      });
    } else if (action === "watched") {
      const existingTags = (prevItem?.tags || []).filter((t) => t !== "not-interested");
      const mergedTags =
        customTags.length > 0
          ? Array.from(new Set([...existingTags, ...customTags]))
          : existingTags;
      await upsertWatchlistItem({
        userId,
        tmdbId,
        mediaType,
        title,
        posterPath,
        releaseYear,
        status: targetStatus,
        rating: userRating !== undefined && !isNaN(userRating) ? userRating : undefined,
        review: userReview,
        tags: mergedTags,
        mergeTags: false,
      });
    } else if (action === "never") {
      // Never: Dropped + merge "not-interested" tag
      await upsertWatchlistItem({
        userId,
        tmdbId,
        mediaType,
        title,
        posterPath,
        releaseYear,
        status: "Dropped",
        tags: ["not-interested"],
        mergeTags: true,
      });
    }
    // "pass" writes no watchlist item

    // 3. Insert SwipeEvent
    const swipeEvent = await SwipeEvent.create({
      userId,
      tmdbId,
      mediaType,
      action,
      source: source || "trending",
      position: typeof position === "number" ? position : undefined,
      prevItemSnapshot: prevItem || null,
      undone: false,
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      eventId: swipeEvent._id.toString(),
    });
  } catch (err: unknown) {
    console.error("Swipe recording error:", err);
    return NextResponse.json({ error: "Failed to record swipe" }, { status: 500 });
  }
}
