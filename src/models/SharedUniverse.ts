import mongoose, { Schema, models, model } from "mongoose";

export interface ISharedUniverseItem {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  releaseYear: number | null;
}

export interface ISharedUniverse {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  items: ISharedUniverseItem[];
  createdAt: Date;
  updatedAt: Date;
}

const SharedUniverseItemSchema = new Schema<ISharedUniverseItem>({
  tmdbId: { type: Number, required: true },
  mediaType: { type: String, enum: ["movie", "tv"], required: true },
  title: { type: String, required: true },
  posterPath: { type: String, default: null },
  releaseYear: { type: Number, default: null },
});

const SharedUniverseSchema = new Schema<ISharedUniverse>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String, required: true },
    items: { type: [SharedUniverseItemSchema], default: [] },
  },
  { timestamps: true }
);

export const SharedUniverse =
  models.SharedUniverse ?? model<ISharedUniverse>("SharedUniverse", SharedUniverseSchema);
