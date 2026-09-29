import { WatchlistItem, IWatchlistItem } from "@/models/WatchlistItem";
import { type WatchStatus } from "@/lib/constants";

export interface UpsertWatchlistItemParams {
  userId: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath?: string | null;
  releaseYear?: number | null;
  status?: WatchStatus;
  rating?: number | null;
  review?: string | null;
  tags?: string[];
  mergeTags?: boolean;
}

export async function upsertWatchlistItem({
  userId,
  tmdbId,
  mediaType,
  title,
  posterPath,
  releaseYear,
  status = "Plan to Watch",
  rating,
  review,
  tags,
  mergeTags = false,
}: UpsertWatchlistItemParams) {
  // Find previous item if any
  const previousItem = await WatchlistItem.findOne({
    userId,
    tmdbId,
    mediaType,
  }).lean<IWatchlistItem | null>();

  let finalTags: string[] = [];
  if (mergeTags && previousItem?.tags) {
    finalTags = Array.from(new Set([...previousItem.tags, ...(tags ?? [])]));
  } else if (tags !== undefined) {
    finalTags = tags;
  } else if (previousItem?.tags) {
    finalTags = previousItem.tags;
  }

  const updateDoc: Record<string, unknown> = {
    userId,
    tmdbId,
    mediaType,
    title,
    posterPath: posterPath !== undefined ? posterPath : (previousItem?.posterPath ?? null),
    releaseYear: releaseYear !== undefined ? releaseYear : (previousItem?.releaseYear ?? null),
    status,
    tags: finalTags,
    dateAdded: previousItem?.dateAdded ?? new Date(),
  };

  if (rating !== undefined) {
    updateDoc.rating = rating ?? undefined;
  } else if (previousItem?.rating !== undefined) {
    updateDoc.rating = previousItem.rating;
  }

  if (review !== undefined) {
    updateDoc.review = review ?? undefined;
  } else if (previousItem?.review !== undefined) {
    updateDoc.review = previousItem.review;
  }

  const item = await WatchlistItem.findOneAndUpdate(
    { userId, tmdbId, mediaType },
    updateDoc,
    { upsert: true, new: true }
  );

  return {
    item,
    previousItem,
  };
}
