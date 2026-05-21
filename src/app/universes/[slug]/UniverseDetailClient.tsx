"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Block } from "@/components/Block";
import { WatchlistModal } from "@/components/WatchlistModal";
import { sound } from "@/lib/audio";
import { WATCH_STATUSES } from "@/lib/constants";

interface UniverseItem {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  releaseYear: number | null;
}

interface UniverseData {
  _id: string;
  name: string;
  slug: string;
  description: string;
  items: UniverseItem[];
}

interface UserRating {
  status: "Plan to Watch" | "Watching" | "Completed" | "Dropped";
  rating?: number;
  review?: string;
}

export function UniverseDetailClient() {
  const { slug } = useParams() as { slug: string };
  const { data: session } = useSession();
  
  const [data, setData] = useState<{
    universe: UniverseData;
    userRating: UserRating | null;
    movieRatings: Record<number, { _id: string; status: any; rating?: number; review?: string; tags?: string[] }>;
  } | null>(null);
  
  const [loading, setLoading] = useState(true);
  
  // Universe rating form state
  const [universeStatus, setUniverseStatus] = useState<string>("Plan to Watch");
  const [universeRating, setUniverseRating] = useState<string>("");
  const [universeReview, setUniverseReview] = useState<string>("");
  const [savingRating, setSavingRating] = useState(false);

  // Movie modal state
  const [selectedMovie, setSelectedMovie] = useState<UniverseItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchUniverseDetails = useCallback(async () => {
    try {
      const res = await fetch(`/api/universes/${slug}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        if (json.userRating) {
          setUniverseStatus(json.userRating.status ?? "Plan to Watch");
          setUniverseRating(json.userRating.rating?.toString() ?? "");
          setUniverseReview(json.userRating.review ?? "");
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchUniverseDetails();
  }, [fetchUniverseDetails]);

  const handleSaveUniverseRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setSavingRating(true);
    sound.play("click");

    try {
      const res = await fetch(`/api/universes/${slug}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: universeStatus,
          rating: universeRating ? parseInt(universeRating, 10) : null,
          review: universeReview,
        }),
      });

      if (res.ok) {
        sound.play("success");
        await fetchUniverseDetails();
      } else {
        alert("Failed to save cinematic universe rating.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save cinematic universe rating.");
    } finally {
      setSavingRating(false);
    }
  };

  const handleRateMovie = (movie: UniverseItem) => {
    sound.play("click");
    setSelectedMovie(movie);
    setModalOpen(true);
  };

  const getStatusBadgeStyle = (mediaType: "movie" | "tv") => {
    return mediaType === "tv"
      ? "bg-[#00E5FF] text-zinc-950 border-[#00E5FF]/30"
      : "bg-[#FF5722] text-white border-[#FF5722]/30";
  };

  const getWatchStatusBadgeStyle = (status: string) => {
    switch (status) {
      case "Completed":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "Watching":
        return "bg-red-50 text-red-600 border-red-100";
      case "Plan to Watch":
        return "bg-zinc-50 text-zinc-500 border-zinc-200";
      case "Dropped":
        return "bg-zinc-100 text-zinc-400 border-zinc-200 line-through";
      default:
        return "bg-zinc-50 border-zinc-200 text-zinc-600";
    }
  };

  if (loading) {
    return (
      <div className="py-12 font-mono text-xs uppercase tracking-wider text-center text-zinc-400 animate-pulse select-none">
        CONNECTING TO UNIVERSE VIEWPORT...
      </div>
    );
  }

  if (!data || !data.universe) {
    return (
      <Block className="text-center py-16">
        <p className="font-sans font-black text-2xl uppercase tracking-tight text-zinc-900 mb-2">
          Universe Not Found
        </p>
        <p className="text-sm text-zinc-500 font-medium mb-6">
          The requested cinematic universe could not be located in our cached database.
        </p>
        <Link
          href="/universes"
          onClick={() => sound.play("click")}
          className="bg-zinc-900 hover:bg-zinc-800 text-white px-5 py-2.5 text-[10px] font-mono font-bold tracking-widest uppercase rounded-sm border border-zinc-900 cursor-pointer shadow-md select-none transition-all duration-200"
        >
          [Back to Universes]
        </Link>
      </Block>
    );
  }

  const { universe, movieRatings } = data;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Header Block */}
      <Block
        className="bg-white border border-zinc-200"
        header={
          <>
            <span>Universe Details</span>
            <Link
              href="/universes"
              onClick={() => sound.play("click")}
              className="text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              [Back to Universes]
            </Link>
          </>
        }
      >
        <h1 className="font-sans font-black text-4xl md:text-5xl uppercase tracking-tighter text-zinc-900">
          {universe.name}
        </h1>
        <p className="text-sm text-zinc-600 font-medium mt-3 leading-relaxed max-w-4xl">
          {universe.description}
        </p>
      </Block>

      {/* Universe Rating Section */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Rating Card */}
        <div className="lg:col-span-1">
          <div className="p-6 bg-white border border-zinc-200 rounded-sm shadow-sm flex flex-col gap-5 select-none">
            <p className="font-sans font-black text-lg uppercase tracking-tight border-b border-zinc-100 pb-2 text-zinc-900">
              Universe Rating
            </p>

            {session ? (
              <form onSubmit={handleSaveUniverseRating} className="space-y-5">
                {/* Watch Status */}
                <div>
                  <label className="block text-[9px] font-mono font-bold uppercase mb-2 tracking-widest text-zinc-400">
                    Watch Status
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {["Plan to Watch", "Watching", "Completed", "Dropped"].map((s) => {
                      const isSelected = universeStatus === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onMouseEnter={() => sound.play("hover")}
                          onClick={() => {
                            sound.play("click");
                            setUniverseStatus(s);
                          }}
                          className={`py-1.5 px-2 border font-sans font-bold uppercase text-[9px] tracking-wide text-left transition-all duration-200 flex items-center justify-between cursor-pointer rounded-sm ${
                            isSelected
                              ? "bg-zinc-900 border-zinc-900 text-white"
                              : "bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100"
                          }`}
                        >
                          <span>{s}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Rating 1-10 */}
                <div>
                  <label className="block text-[9px] font-mono font-bold uppercase mb-2 tracking-widest text-zinc-400">
                    Rating (1-10)
                  </label>
                  <div className="grid grid-cols-5 gap-1">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                      const isSelected = universeRating === num.toString();
                      return (
                        <button
                          key={num}
                          type="button"
                          onMouseEnter={() => sound.play("hover")}
                          onClick={() => {
                            sound.play("click");
                            setUniverseRating(isSelected ? "" : num.toString());
                          }}
                          className={`h-7 border font-mono font-bold text-[10px] flex items-center justify-center transition-all duration-200 cursor-pointer rounded-sm ${
                            isSelected
                              ? "bg-zinc-900 border-zinc-900 text-white"
                              : "bg-zinc-50 border-zinc-200 text-zinc-500 hover:bg-zinc-100"
                          }`}
                        >
                          {num}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Review */}
                <div>
                  <label className="block text-[9px] font-mono font-bold uppercase mb-2 tracking-widest text-zinc-400">
                    Overall Review
                  </label>
                  <textarea
                    value={universeReview}
                    onChange={(e) => setUniverseReview(e.target.value)}
                    rows={4}
                    className="w-full border border-zinc-200 p-2.5 bg-zinc-50/50 font-sans text-xs tracking-wide leading-relaxed rounded-sm focus:outline-none focus:bg-white focus:border-zinc-400 transition-all resize-none text-zinc-800"
                    placeholder="Rate the franchise as a whole..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingRating}
                  className="w-full bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white py-2 text-[10px] font-mono font-bold tracking-widest uppercase transition-all duration-200 rounded-sm cursor-pointer"
                >
                  {savingRating ? "SAVING..." : "SAVE RATING"}
                </button>
              </form>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Sign in to log and rate this cinematic universe as a whole.
                </p>
                <Link
                  href={`/auth/signin?callbackUrl=/universes/${slug}`}
                  onClick={() => sound.play("click")}
                  className="block text-center bg-zinc-900 hover:bg-zinc-800 text-white py-2 text-[10px] font-mono font-bold tracking-widest uppercase rounded-sm cursor-pointer transition-all"
                >
                  SIGN IN TO RATE
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Movies Grid */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-zinc-50 border border-zinc-200 p-4 font-mono text-[10px] tracking-widest uppercase flex justify-between select-none rounded-sm text-zinc-500">
            <span>CANON CHECKLIST</span>
            <span>{universe.items.length} TITLES IN SEQUENCE</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {universe.items.map((item) => {
              const userWatched = movieRatings[item.tmdbId];
              return (
                <div
                  key={item.tmdbId}
                  className={`border rounded-sm overflow-hidden bg-white shadow-sm flex flex-col justify-between transition-all duration-300 hover:shadow-md ${
                    userWatched ? "border-zinc-300" : "border-zinc-200 hover:border-zinc-300"
                  }`}
                >
                  <div className="relative aspect-[2/3] bg-zinc-50 overflow-hidden">
                    {item.posterPath ? (
                      <Image
                        src={item.posterPath}
                        alt={item.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                        no image
                      </div>
                    )}

                    <div className="absolute top-2 left-2 flex gap-1 select-none">
                      <span className={`text-[8px] font-mono font-semibold px-2 py-0.5 border uppercase rounded-sm ${getStatusBadgeStyle(item.mediaType)}`}>
                        {item.mediaType}
                      </span>
                      {item.releaseYear && (
                        <span className="text-[8px] font-mono bg-zinc-950/80 text-white px-1.5 py-0.5 border border-zinc-800/80 rounded-sm">
                          {item.releaseYear}
                        </span>
                      )}
                    </div>

                    {userWatched && (
                      <div className="absolute top-2 right-2 flex flex-col items-end gap-1 select-none">
                        <span className={`text-[8px] font-mono font-semibold px-2 py-0.5 border uppercase rounded-sm ${getWatchStatusBadgeStyle(userWatched.status)}`}>
                          {userWatched.status}
                        </span>
                        {userWatched.rating && (
                          <span className="text-[8px] font-mono font-extrabold bg-zinc-950 text-[#39FF14] px-1.5 py-0.5 border border-zinc-800 rounded-sm">
                            ★ {userWatched.rating}/10
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="p-4 space-y-4">
                    <h3 className="font-sans font-black text-sm uppercase tracking-wide text-zinc-900 leading-snug line-clamp-2" title={item.title}>
                      {item.title}
                    </h3>

                    {session ? (
                      <button
                        type="button"
                        onClick={() => handleRateMovie(item)}
                        className={`w-full py-1.5 text-[9px] font-mono font-bold tracking-widest uppercase transition-all duration-200 rounded-sm cursor-pointer ${
                          userWatched
                            ? "bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200"
                            : "bg-zinc-900 hover:bg-zinc-800 text-white border border-transparent"
                        }`}
                      >
                        {userWatched ? "EDIT RATING" : "LOG & RATE"}
                      </button>
                    ) : (
                      <Link
                        href={`/auth/signin?callbackUrl=/universes/${slug}`}
                        onClick={() => sound.play("click")}
                        className="block text-center w-full bg-zinc-50 hover:bg-zinc-100 text-zinc-500 py-1.5 text-[9px] font-mono font-bold tracking-widest uppercase border border-zinc-200 rounded-sm"
                      >
                        SIGN IN TO LOG
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {modalOpen && selectedMovie && (
        <WatchlistModal
          open={modalOpen}
          onClose={() => {
            sound.play("click");
            setModalOpen(false);
            setSelectedMovie(null);
          }}
          media={{
            tmdbId: selectedMovie.tmdbId,
            mediaType: selectedMovie.mediaType,
            title: selectedMovie.title,
            posterPath: selectedMovie.posterPath,
            releaseYear: selectedMovie.releaseYear,
          }}
          existingItem={
            movieRatings[selectedMovie.tmdbId]
              ? {
                  _id: movieRatings[selectedMovie.tmdbId]._id,
                  status: movieRatings[selectedMovie.tmdbId].status,
                  rating: movieRatings[selectedMovie.tmdbId].rating,
                  review: movieRatings[selectedMovie.tmdbId].review,
                  tags: movieRatings[selectedMovie.tmdbId].tags,
                }
              : null
          }
          onSaved={() => {
            fetchUniverseDetails();
          }}
        />
      )}
    </div>
  );
}
