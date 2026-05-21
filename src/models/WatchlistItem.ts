import mongoose, { Schema, models, model } from "mongoose";
import { WATCH_STATUSES } from "@/lib/constants";

export interface IWatchlistItem {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  releaseYear: number | null;
  status: (typeof WATCH_STATUSES)[number];
  rating?: number;
  review?: string;
  tags?: string[];
  dateAdded: Date;
}

const WatchlistItemSchema = new Schema<IWatchlistItem>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tmdbId: { type: Number, required: true },
    mediaType: { type: String, enum: ["movie", "tv"], required: true },
    title: { type: String, required: true },
    posterPath: { type: String, default: null },
    releaseYear: { type: Number, default: null },
    status: {
      type: String,
      enum: WATCH_STATUSES,
      default: "Plan to Watch",
    },
    rating: { type: Number, min: 1, max: 10 },
    review: { type: String },
    tags: { type: [String], default: [] },
    dateAdded: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

WatchlistItemSchema.index({ userId: 1, tmdbId: 1, mediaType: 1 }, { unique: true });

export const WatchlistItem =
  models.WatchlistItem ?? model<IWatchlistItem>("WatchlistItem", WatchlistItemSchema);
