import mongoose, { Schema, models, model } from "mongoose";

export interface IMediaFeature {
  _id: mongoose.Types.ObjectId;
  tmdbId: number;
  mediaType: "movie" | "tv";
  genreIds: number[];
  genreNames: string[];
  keywords: string[];
  topCast: string[];
  creators: string[];
  decade: number;
  lang: string;
  voteAverage: number;
  popularity: number;
  fetchedAt: Date;
}

const MediaFeatureSchema = new Schema<IMediaFeature>(
  {
    tmdbId: { type: Number, required: true },
    mediaType: { type: String, enum: ["movie", "tv"], required: true },
    genreIds: { type: [Number], default: [] },
    genreNames: { type: [String], default: [] },
    keywords: { type: [String], default: [] },
    topCast: { type: [String], default: [] },
    creators: { type: [String], default: [] },
    decade: { type: Number, default: 0 },
    lang: { type: String, default: "" },
    voteAverage: { type: Number, default: 0 },
    popularity: { type: Number, default: 0 },
    fetchedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

MediaFeatureSchema.index({ tmdbId: 1, mediaType: 1 }, { unique: true });

export const MediaFeature =
  models.MediaFeature ?? model<IMediaFeature>("MediaFeature", MediaFeatureSchema);
