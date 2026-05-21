"use client";

import Link from "next/link";
import Image from "next/image";
import { posterUrl, getTitle, getReleaseYear } from "@/lib/tmdb";
import type { TmdbSearchResult } from "@/lib/tmdb";
import { sound } from "@/lib/audio";

interface MediaCardProps {
  item: TmdbSearchResult;
}

export function MediaCard({ item }: MediaCardProps) {
  const type = (item.media_type ?? "movie") as "movie" | "tv";
  const poster = posterUrl(item.poster_path, "w342");
  const year = getReleaseYear(item);

  return (
    <Link
      href={`/media/${type}/${item.id}`}
      onMouseEnter={() => {
        sound.play("hover");
        window.dispatchEvent(
          new CustomEvent("oscilloscope-active", { detail: { active: true } })
        );
      }}
      onMouseLeave={() => {
        window.dispatchEvent(
          new CustomEvent("oscilloscope-active", { detail: { active: false } })
        );
      }}
      onClick={() => {
        sound.play("click");
      }}
      className="group block bg-white border border-zinc-200 hover:border-zinc-400 hover:shadow-md transition-all duration-300 ease-out rounded-sm overflow-hidden"
    >
      <div className="aspect-[2/3] relative bg-zinc-100 overflow-hidden">
        {poster ? (
          <Image
            src={poster}
            alt={getTitle(item)}
            fill
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-102"
            sizes="(max-width: 768px) 50vw, 20vw"
            priority={false}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-zinc-400 uppercase tracking-widest p-4 text-center">
            no poster
          </div>
        )}
        <span
          className={`absolute top-2 left-2 px-2 py-0.5 text-[9px] font-mono tracking-widest uppercase select-none rounded-sm shadow-sm transition-all duration-200 border ${
            type === "tv"
              ? "bg-[#00E5FF] text-zinc-950 border-[#00E5FF]/30 shadow-cyan-500/10"
              : "bg-[#FF5722] text-white border-[#FF5722]/30 shadow-orange-500/10"
          }`}
        >
          {type}
        </span>

        {/* Slide-up metadata overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-zinc-950/90 text-white text-[9px] font-mono tracking-wider uppercase px-3 py-2 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out flex justify-between items-center select-none z-10 border-t border-zinc-800">
          <span>★ {item.vote_average ? item.vote_average.toFixed(1) : "—"} / 10</span>
          <span>{year ?? "—"}</span>
        </div>
      </div>
      <div className="p-3.5 border-t border-zinc-100">
        <h3 className="font-sans font-bold text-xs uppercase tracking-wide text-zinc-900 group-hover:text-zinc-950 group-hover:underline decoration-1 underline-offset-2 transition-colors line-clamp-2 leading-snug">
          {getTitle(item)}
        </h3>
        {year && (
          <p className="text-[10px] font-mono text-zinc-400 mt-1.5 select-none tracking-wider">
            {year}
          </p>
        )}
      </div>
    </Link>
  );
}
