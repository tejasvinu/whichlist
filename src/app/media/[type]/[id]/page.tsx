import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { WatchlistItem } from "@/models/WatchlistItem";
import {
  getMovieDetails,
  getTvDetails,
  type TmdbMovieDetails,
  type TmdbTvDetails,
} from "@/lib/tmdb";
import { MediaDetailClient } from "@/components/MediaDetailClient";
import { RecommendationPanel } from "@/components/RecommendationPanel";
import { Block } from "@/components/Block";
import type { MediaType } from "@/lib/constants";
import type { WatchStatus } from "@/lib/constants";

interface PageProps {
  params: Promise<{ type: string; id: string }>;
}

export default async function MediaPage({ params }: PageProps) {
  const { type, id } = await params;

  if (type !== "movie" && type !== "tv") notFound();

  const tmdbId = parseInt(id, 10);
  if (isNaN(tmdbId)) notFound();

  let details;
  try {
    details = type === "movie" ? await getMovieDetails(tmdbId) : await getTvDetails(tmdbId);
  } catch {
    notFound();
  }

  const movieDetails = details as TmdbMovieDetails;
  const tvDetails = details as TmdbTvDetails;

  const releaseYear =
    type === "movie"
      ? movieDetails.release_date
        ? parseInt(movieDetails.release_date.slice(0, 4), 10)
        : null
      : tvDetails.first_air_date
        ? parseInt(tvDetails.first_air_date.slice(0, 4), 10)
        : null;

  const runtime =
    type === "movie"
      ? movieDetails.runtime
        ? `${movieDetails.runtime} min`
        : null
      : tvDetails.episode_run_time?.[0]
        ? `${tvDetails.episode_run_time[0]} min/ep`
        : null;

  const session = await auth();
  let existingWatchlist: {
    _id: string;
    status: WatchStatus;
    rating?: number;
    review?: string;
    tags?: string[];
  } | null = null;

  if (session?.user?.id) {
    await connectDB();
    const item = await WatchlistItem.findOne({
      userId: session.user.id,
      tmdbId,
      mediaType: type,
    }).lean();
    if (item) {
      existingWatchlist = {
        _id: item._id.toString(),
        status: item.status as WatchStatus,
        rating: item.rating,
        review: item.review,
        tags: item.tags,
      };
    }
  }

  const title = type === "movie" ? movieDetails.title : tvDetails.name;

  return (
    <div className="space-y-6">
      <Block header={<span>Media Detail</span>}>
        <MediaDetailClient
          type={type as MediaType}
          details={details}
          releaseYear={releaseYear}
          runtime={runtime}
          existingWatchlist={existingWatchlist}
        />
      </Block>
      
      <RecommendationPanel title={title} mediaType={type} />
    </div>
  );
}
