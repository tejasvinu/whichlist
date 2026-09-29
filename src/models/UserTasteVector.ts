import mongoose, { Schema, models, model } from "mongoose";

export interface IUserTasteVector {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  weights: Record<string, number>;
  signalCount: number;
  computedAt: Date;
}

const UserTasteVectorSchema = new Schema<IUserTasteVector>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    weights: { type: Schema.Types.Mixed, default: {} },
    signalCount: { type: Number, default: 0 },
    computedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export const UserTasteVector =
  models.UserTasteVector ?? model<IUserTasteVector>("UserTasteVector", UserTasteVectorSchema);
