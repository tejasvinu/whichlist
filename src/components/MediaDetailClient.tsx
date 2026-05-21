"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { posterUrl, getTrailerUrl } from "@/lib/tmdb";
import type { TmdbMovieDetails, TmdbTvDetails } from "@/lib/tmdb";
import { WatchlistModal, type WatchlistFormData } from "./WatchlistModal";
import type { MediaType, WatchStatus } from "@/lib/constants";
import { sound } from "@/lib/audio";

interface MediaDetailClientProps {
  type: MediaType;
  details: TmdbMovieDetails | TmdbTvDetails;
  releaseYear: number | null;
  runtime: string | null;
  existingWatchlist?: {
    _id: string;
    status: WatchStatus;
    rating?: number;
    review?: string;
  } | null;
}

export function MediaDetailClient({
  type,
  details,
  releaseYear,
  runtime,
  existingWatchlist,
}: MediaDetailClientProps) {
  const { data: session } = useSession();
  const [modalOpen, setModalOpen] = useState(false);

  const title = "title" in details ? details.title : details.name;
  const backdrop = posterUrl(details.backdrop_path, "original");
  const poster = posterUrl(details.poster_path, "w500");
  const trailer = getTrailerUrl(details.videos);
  const cast = details.credits?.cast.slice(0, 12) ?? [];
  const directors = details.credits?.crew.filter((c) => c.job === "Director").slice(0, 3) ?? [];

  const formData: WatchlistFormData = {
    tmdbId: details.id,
    mediaType: type,
    title,
    posterPath: poster,
    releaseYear,
  };

  return (
    <div className="animate-fade-in">
      {backdrop && (
        <div className="relative h-56 md:h-80 -mx-6 -mt-6 mb-8 border-b border-zinc-200 overflow-hidden select-none">
          <Image 
            src={backdrop} 
            alt="" 
            fill 
            className="object-cover opacity-90 transition-opacity duration-300" 
            priority 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white via-white/40 to-transparent" />
        </div>
      )}

      <div className="grid md:grid-cols-[220px_1fr] gap-8">
        <div className="border border-zinc-200 shadow-lg aspect-[2/3] relative bg-zinc-100 rounded-sm overflow-hidden self-start">
          {poster ? (
            <Image src={poster} alt={title} fill className="object-cover" sizes="220px" priority />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center font-mono text-zinc-400 text-xs tracking-widest uppercase">
              no poster
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <span
            className={`inline-flex self-start px-2.5 py-0.5 text-[9px] font-mono tracking-widest uppercase mb-4 shadow-sm rounded-sm select-none border ${
              type === "tv"
                ? "bg-[#00E5FF] text-zinc-950 border-[#00E5FF]/30 shadow-cyan-500/10"
                : "bg-[#FF5722] text-white border-[#FF5722]/30 shadow-orange-500/10"
            }`}
          >
            {type}
          </span>
          <h1 className="font-sans font-black text-4xl md:text-6xl lg:text-7xl uppercase tracking-tighter leading-none mb-4 text-zinc-950">
            {title}
          </h1>
          <div className="flex flex-wrap gap-3 items-center text-xs font-semibold text-zinc-500 mb-5 select-none">
            {releaseYear && <span className="font-mono text-zinc-400 tracking-wider">{releaseYear}</span>}
            {releaseYear && runtime && <span className="text-zinc-300">•</span>}
            {runtime && <span className="font-mono text-zinc-400 tracking-wider">{runtime}</span>}
            {(releaseYear || runtime) && details.genres.length > 0 && <span className="text-zinc-300">•</span>}
            <div className="flex flex-wrap gap-1.5">
              {details.genres.map((g) => (
                <span key={g.id} className="border border-zinc-200 bg-zinc-50/50 text-[10px] text-zinc-500 px-2 py-0.5 rounded-sm font-sans font-semibold uppercase tracking-wider">
                  {g.name}
                </span>
              ))}
            </div>
          </div>

          <p className="text-zinc-600 text-sm md:text-base leading-relaxed mb-8 max-w-3xl font-medium">
            {details.overview}
          </p>

          <div className="flex flex-wrap gap-3 mb-8">
            {session ? (
              <button
                type="button"
                onMouseEnter={() => sound.play("hover")}
                onClick={() => {
                  sound.play("click");
                  setModalOpen(true);
                }}
                className="bg-zinc-900 border border-transparent text-white px-6 py-3 font-sans font-bold text-xs tracking-widest uppercase hover:bg-zinc-800 transition-all duration-200 rounded-sm shadow-md shadow-zinc-950/10 cursor-pointer"
              >
                {existingWatchlist ? "Update List" : "Add to List →"}
              </button>
            ) : (
              <Link
                href="/auth/signin"
                onMouseEnter={() => sound.play("hover")}
                onClick={() => sound.play("click")}
                className="bg-zinc-900 border border-transparent text-white px-6 py-3 font-sans font-bold text-xs tracking-widest uppercase hover:bg-zinc-800 transition-all duration-200 rounded-sm shadow-md shadow-zinc-950/10 cursor-pointer text-center"
              >
                Sign In →
              </Link>
            )}
            {trailer && (
              <a
                href={trailer}
                target="_blank"
                rel="noopener noreferrer"
                onMouseEnter={() => sound.play("hover")}
                onClick={() => sound.play("click")}
                className="border border-zinc-300 px-6 py-3 font-sans font-bold text-xs tracking-widest uppercase hover:bg-zinc-950 hover:text-white hover:border-zinc-950 transition-all duration-200 rounded-sm cursor-pointer text-zinc-700 text-center"
              >
                Watch Trailer
              </a>
            )}
          </div>

          {directors.length > 0 && (
            <div className="mb-8">
              <h2 className="font-mono text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-2.5 border-b border-zinc-100 pb-1.5 select-none">
                Director
              </h2>
              <p className="text-zinc-800 text-sm font-bold">{directors.map((d) => d.name).join(", ")}</p>
            </div>
          )}

          {cast.length > 0 && (
            <div>
              <h2 className="font-mono text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-3 border-b border-zinc-100 pb-1.5 select-none">
                Cast
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {cast.map((member) => (
                  <div key={member.id} className="text-xs">
                    <p className="font-bold text-zinc-800">{member.name}</p>
                    <p className="text-[10px] font-mono text-zinc-400 mt-0.5 tracking-wide">{member.character}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <WatchlistModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        media={formData}
        existingItem={existingWatchlist}
        onSaved={() => window.location.reload()}
      />
    </div>
  );
}
