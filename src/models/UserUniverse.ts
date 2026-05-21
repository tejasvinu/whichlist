import mongoose, { Schema, models, model } from "mongoose";

export interface IUserUniverse {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  universeId: mongoose.Types.ObjectId;
  status: "Plan to Watch" | "Watching" | "Completed" | "Dropped";
  rating?: number;
  review?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserUniverseSchema = new Schema<IUserUniverse>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    universeId: { type: Schema.Types.ObjectId, ref: "SharedUniverse", required: true, index: true },
    status: {
      type: String,
      enum: ["Plan to Watch", "Watching", "Completed", "Dropped"],
      default: "Plan to Watch",
    },
    rating: { type: Number, min: 1, max: 10 },
    review: { type: String },
  },
  { timestamps: true }
);

UserUniverseSchema.index({ userId: 1, universeId: 1 }, { unique: true });

export const UserUniverse =
  models.UserUniverse ?? model<IUserUniverse>("UserUniverse", UserUniverseSchema);
