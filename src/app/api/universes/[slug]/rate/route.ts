import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { SharedUniverse } from "@/models/SharedUniverse";
import { UserUniverse } from "@/models/UserUniverse";
import { auth } from "@/lib/auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { slug } = await params;
    const body = await request.json();
    const { status, rating, review } = body;

    const allowedStatuses = ["Plan to Watch", "Watching", "Completed", "Dropped"];
    if (status && !allowedStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    if (rating != null && (rating < 1 || rating > 10)) {
      return NextResponse.json({ error: "Rating must be between 1 and 10" }, { status: 400 });
    }

    await connectDB();

    const universe = await SharedUniverse.findOne({ slug });
    if (!universe) {
      return NextResponse.json({ error: "Universe not found" }, { status: 404 });
    }

    const userRating = await UserUniverse.findOneAndUpdate(
      { userId: session.user.id, universeId: universe._id },
      {
        userId: session.user.id,
        universeId: universe._id,
        status: status ?? "Plan to Watch",
        rating: rating ?? undefined,
        review: review ?? undefined,
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({ userRating });
  } catch (err) {
    console.error("Failed to rate universe:", err);
    return NextResponse.json({ error: "Failed to rate universe" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { slug } = await params;
    await connectDB();

    const universe = await SharedUniverse.findOne({ slug });
    if (!universe) {
      return NextResponse.json({ error: "Universe not found" }, { status: 404 });
    }

    await UserUniverse.deleteOne({ userId: session.user.id, universeId: universe._id });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to delete universe rating:", err);
    return NextResponse.json({ error: "Failed to delete universe rating" }, { status: 500 });
  }
}

