import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { WatchlistItem } from "@/models/WatchlistItem";
import { WATCH_STATUSES } from "@/lib/constants";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { status, rating, review, tags } = body;

  const update: Record<string, unknown> = {};
  if (status !== undefined) {
    if (!WATCH_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    update.status = status;
  }
  if (rating !== undefined) {
    if (rating !== null && (rating < 1 || rating > 10)) {
      return NextResponse.json({ error: "Rating must be 1-10" }, { status: 400 });
    }
    update.rating = rating;
  }
  if (review !== undefined) update.review = review;
  if (tags !== undefined) {
    if (!Array.isArray(tags)) {
      return NextResponse.json({ error: "Tags must be an array" }, { status: 400 });
    }
    update.tags = tags;
  }

  await connectDB();
  const item = await WatchlistItem.findOneAndUpdate(
    { _id: id, userId: session.user.id },
    update,
    { new: true }
  );

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ item });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await connectDB();

  const result = await WatchlistItem.deleteOne({ _id: id, userId: session.user.id });
  if (result.deletedCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
