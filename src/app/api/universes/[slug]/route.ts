import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { SharedUniverse, ISharedUniverse } from "@/models/SharedUniverse";
import { UserUniverse } from "@/models/UserUniverse";
import { WatchlistItem } from "@/models/WatchlistItem";
import { auth } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    await connectDB();

    const universe = (await SharedUniverse.findOne({ slug }).lean()) as ISharedUniverse | null;
    if (!universe) {
      return NextResponse.json({ error: "Universe not found" }, { status: 404 });
    }

    const session = await auth();
    let userRating = null;
    let movieRatings: Record<number, any> = {};

    if (session?.user?.id) {
      userRating = await UserUniverse.findOne({
        userId: session.user.id,
        universeId: universe._id,
      }).lean();

      const tmdbIds = universe.items.map((item) => item.tmdbId);
      const itemsInWatchlist = await WatchlistItem.find({
        userId: session.user.id,
        tmdbId: { $in: tmdbIds },
      }).lean();

      itemsInWatchlist.forEach((item) => {
        movieRatings[item.tmdbId] = {
          _id: item._id.toString(),
          rating: item.rating,
          status: item.status,
          review: item.review,
          tags: item.tags || [],
        };
      });
    }

    return NextResponse.json({
      universe,
      userRating,
      movieRatings,
    });
  } catch (err) {
    console.error("Failed to fetch universe details:", err);
    return NextResponse.json({ error: "Failed to fetch universe details" }, { status: 500 });
  }
}
