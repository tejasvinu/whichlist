"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { posterUrl, getTitle } from "@/lib/tmdb";
import type { TmdbSearchResult } from "@/lib/tmdb";
import { sound } from "@/lib/audio";

export interface SearchDisplayItem {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  matchReason?: string;
  relevanceScore?: number;
}

export function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchDisplayItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [vibeMode, setVibeMode] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [blink, setBlink] = useState(true);

  // Blinking cursor loop for the placeholder
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setBlink((b) => !b);
    }, 530);
    return () => clearInterval(cursorInterval);
  }, []);
  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    
    sound.play("click");
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(query.trim())}&vibe=${vibeMode}`);
  }
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        if (vibeMode) {
          const res = await fetch("/api/ai/vibe-search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: query.trim() }),
          });
          const data = await res.json();
          if (data.results) {
            const mapped = data.results.map((item: any) => ({
              id: item.tmdbId,
              mediaType: item.mediaType,
              title: item.title,
              posterPath: item.posterPath,
              matchReason: item.matchReason,
              relevanceScore: item.relevanceScore,
            }));
            setResults(mapped);
            setOpen(true);
            if (mapped.length > 0) {
              sound.play("laser");
            }
          }
        } else {
          const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
          const data = await res.json();
          if (data.results) {
            const mapped = data.results.map((item: any) => ({
              id: item.id,
              mediaType: item.media_type as "movie" | "tv",
              title: item.title ?? item.name ?? "Untitled",
              posterPath: posterUrl(item.poster_path, "w342"),
            }));
            setResults(mapped);
            setOpen(true);
            if (mapped.length > 0) {
              sound.play("laser");
            }
          }
        }
      } catch (error) {
        console.error("Search failed:", error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query, vibeMode]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const placeholderText = vibeMode
    ? `DESCRIBE THE VIBE (e.g. cozy sci-fi)...${blink ? "_" : " "}`
    : `SEARCH MOVIES & SHOWS...${blink ? "_" : " "}`;

  return (
    <div ref={wrapperRef} className="relative w-full">
      <form onSubmit={handleSearchSubmit} className="relative flex items-center w-full">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            sound.play("laser");
            if (results.length > 0) setOpen(true);
          }}
          placeholder={placeholderText}
          className="w-full bg-zinc-100/80 text-zinc-900 border border-zinc-200/50 px-4 py-2.5 pl-10 pr-26 font-sans text-xs tracking-wider placeholder:text-zinc-400 placeholder:font-mono focus:outline-none focus:border-zinc-400 focus:bg-white focus:ring-1 focus:ring-zinc-400 transition-all duration-300 shadow-inner rounded-sm"
        />
        <svg
          className="absolute left-3.5 w-4 h-4 text-zinc-400 pointer-events-none"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>

        {loading && (
          <span className="absolute right-20 top-1/2 -translate-y-1/2 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zinc-300 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-zinc-400"></span>
          </span>
        )}

        <button
          type="button"
          onMouseEnter={() => sound.play("hover")}
          onClick={() => {
            sound.play("click");
            setVibeMode(!vibeMode);
            setQuery("");
            setResults([]);
            setOpen(false);
          }}
          className={`absolute right-2 px-2 py-1 text-[9px] font-mono font-bold tracking-wider uppercase border transition-all duration-200 rounded-sm cursor-pointer select-none ${
            vibeMode
              ? "bg-red-600 border-red-600 text-white shadow-sm"
              : "bg-zinc-200/60 border-zinc-300/40 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700"
          }`}
        >
          {vibeMode ? "VIBE LIST" : "GLOBAL"}
        </button>
      </form>

      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-white/95 backdrop-blur-md text-zinc-900 border border-zinc-200 shadow-xl max-h-80 overflow-y-auto overflow-x-hidden rounded-sm animate-fade-in">
          {results.map((item) => {
            return (
              <Link
                key={`${item.mediaType}-${item.id}`}
                href={`/media/${item.mediaType}/${item.id}`}
                onMouseEnter={() => sound.play("hover")}
                onClick={() => {
                  sound.play("click");
                  setOpen(false);
                  setQuery("");
                }}
                className="flex items-center gap-4.5 p-3.5 border-b border-zinc-100 hover:bg-zinc-50 transition-colors group"
              >
                <div className="w-10 h-14 bg-zinc-100 flex-shrink-0 relative border border-zinc-200/50 group-hover:border-zinc-300 transition-colors rounded-sm overflow-hidden">
                  {item.posterPath ? (
                    <Image src={item.posterPath} alt="" fill className="object-cover" sizes="40px" />
                  ) : (
                    <span className="text-[9px] p-1 flex items-center justify-center h-full font-mono text-zinc-400">N/A</span>
                  )}
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className="font-bold text-xs uppercase tracking-wide text-zinc-800 group-hover:text-zinc-950 group-hover:underline decoration-1 underline-offset-2 transition-colors truncate">
                    {item.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-400 group-hover:text-zinc-500 transition-colors">
                      {item.mediaType}
                    </span>
                    {item.relevanceScore && (
                      <span className="text-[9px] font-mono text-red-600 font-bold">
                        MATCH: {item.relevanceScore}/10
                      </span>
                    )}
                  </div>
                  {item.matchReason && (
                    <p className="text-[10px] text-zinc-500 font-medium italic mt-1 line-clamp-2 leading-relaxed">
                      "{item.matchReason}"
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
