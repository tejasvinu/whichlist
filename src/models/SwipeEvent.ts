import mongoose, { Schema, models, model } from "mongoose";

export type SwipeAction = "impression" | "pass" | "like" | "watched" | "never" | "undo";
export type SwipeSource = "trending" | "seed";

export interface ISwipeEvent {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  tmdbId: number;
  mediaType: "movie" | "tv";
  action: SwipeAction;
  source: SwipeSource;
  position?: number;
  prevItemSnapshot?: Record<string, unknown> | null;
  undone: boolean;
  createdAt: Date;
}

const SwipeEventSchema = new Schema<ISwipeEvent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tmdbId: { type: Number, required: true },
    mediaType: { type: String, enum: ["movie", "tv"], required: true },
    action: {
      type: String,
      enum: ["impression", "pass", "like", "watched", "never", "undo"],
      required: true,
    },
    source: { type: String, enum: ["trending", "seed"], default: "trending" },
    position: { type: Number },
    prevItemSnapshot: { type: Schema.Types.Mixed, default: null },
    undone: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

SwipeEventSchema.index({ userId: 1, createdAt: -1 });
SwipeEventSchema.index({ userId: 1, tmdbId: 1, mediaType: 1 });

export const SwipeEvent =
  models.SwipeEvent ?? model<ISwipeEvent>("SwipeEvent", SwipeEventSchema);
