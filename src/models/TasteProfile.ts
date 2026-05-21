import mongoose, { Schema, models, model } from "mongoose";

export interface ITasteProfile {
  userId: mongoose.Types.ObjectId;
  headline: string;
  roast: string;
  archetype: string;
  topPatterns: string[];
  blindSpot: string;
}

const TasteProfileSchema = new Schema<ITasteProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    headline: { type: String, required: true },
    roast: { type: String, required: true },
    archetype: { type: String, required: true },
    topPatterns: { type: [String], required: true },
    blindSpot: { type: String, required: true },
  },
  { timestamps: true }
);

export const TasteProfile =
  models.TasteProfile ?? model<ITasteProfile>("TasteProfile", TasteProfileSchema);
