import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { SwipeEvent } from "@/models/SwipeEvent";
import { WatchlistItem } from "@/models/WatchlistItem";
import { UserTasteVector } from "@/models/UserTasteVector";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const userId = session.user.id;

    // Find latest non-undone swipe event
    const lastEvent = await SwipeEvent.findOne({
      userId,
      undone: false,
      action: { $in: ["pass", "like", "watched", "never"] },
    }).sort({ createdAt: -1 });

    if (!lastEvent) {
      return NextResponse.json({ error: "No swipe event to undo" }, { status: 404 });
    }

    // Restore watchlist state
    if (lastEvent.prevItemSnapshot) {
      // Strip immutable _id / __v before replacement to avoid Mongo immutability errors
      const snapshot = { ...(lastEvent.prevItemSnapshot as Record<string, unknown>) };
      delete snapshot._id;
      delete snapshot.__v;

      await WatchlistItem.findOneAndReplace(
        { userId, tmdbId: lastEvent.tmdbId, mediaType: lastEvent.mediaType },
        snapshot,
        { upsert: true }
      );
    } else {
      // It was newly created by this action (like, watched, never)
      if (["like", "watched", "never"].includes(lastEvent.action)) {
        await WatchlistItem.deleteOne({
          userId,
          tmdbId: lastEvent.tmdbId,
          mediaType: lastEvent.mediaType,
        });
      }
    }

    // Mark event as undone
    lastEvent.undone = true;
    await lastEvent.save();

    // Log explicit undo action event and invalidate cached taste vector
    await Promise.all([
      SwipeEvent.create({
        userId,
        tmdbId: lastEvent.tmdbId,
        mediaType: lastEvent.mediaType,
        action: "undo",
        source: lastEvent.source || "trending",
        position: lastEvent.position,
        undone: false,
        createdAt: new Date(),
      }),
      UserTasteVector.deleteOne({ userId }),
    ]);

    return NextResponse.json({
      success: true,
      undone: {
        tmdbId: lastEvent.tmdbId,
        mediaType: lastEvent.mediaType,
        action: lastEvent.action,
      },
    });
  } catch (err: unknown) {
    console.error("Swipe undo error:", err);
    return NextResponse.json({ error: "Failed to undo swipe" }, { status: 500 });
  }
}
