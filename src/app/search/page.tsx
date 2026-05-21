"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { sound } from "@/lib/audio";
import { Block } from "@/components/Block";
import { WatchlistModal } from "@/components/WatchlistModal";

interface SearchItem {
  id?: number;
  tmdbId?: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  releaseYear?: number | null;
  matchReason?: string;
  relevanceScore?: number;
}

function SearchResultsContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";
  const isVibe = searchParams.get("vibe") === "true";

  const [results, setResults] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    async function executeSearch() {
      setLoading(true);
      setError("");
      try {
        if (isVibe) {
          const res = await fetch("/api/ai/vibe-search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: query.trim() }),
          });
          if (!res.ok) throw new Error("Vibe search telemetry link failed");
          const data = await res.json();
          setResults(data.results ?? []);
        } else {
          const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
          if (!res.ok) throw new Error("TMDB query fetch failed");
          const data = await res.json();
          
          const mapped = (data.results || []).map((item: any) => ({
            id: item.id,
            mediaType: item.media_type as "movie" | "tv",
            title: item.title ?? item.name ?? "Untitled",
            posterPath: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
            releaseYear: item.release_date || item.first_air_date ? new Date(item.release_date || item.first_air_date).getFullYear() : null,
          }));
          setResults(mapped);
        }
      } catch (err: any) {
        setError(err.message || "Search failed.");
      } finally {
        setLoading(false);
      }
    }

    executeSearch();
  }, [query, isVibe]);

  function handleAddToVault(item: SearchItem) {
    sound.play("click");
    setSelectedMedia({
      tmdbId: item.id ?? item.tmdbId,
      mediaType: item.mediaType,
      title: item.title,
      posterPath: item.posterPath,
      releaseYear: item.releaseYear ?? null,
    });
    setModalOpen(true);
  }

  // Helper to build a brutalist relevance gauge: e.g. [████████░░]
  function renderGauge(score: number) {
    const max = 10;
    const filled = Math.min(Math.max(score, 0), max);
    const empty = max - filled;
    return `[${"█".repeat(filled)}${"░".repeat(empty)}]`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-200 pb-4 select-none">
        <div>
          <h1 className="font-sans font-black text-3xl uppercase tracking-tight text-zinc-900">
            Search Results
          </h1>
          <p className="font-mono text-xs text-zinc-400 mt-1 uppercase">
            QUERY: "{query}" // MODE: {isVibe ? "VECTOR VIBE VAULT" : "DIRECT KEYWORD"}
          </p>
        </div>
        {isVibe && (
          <span className="mt-2 md:mt-0 font-mono text-[10px] bg-red-50 text-red-600 border border-red-200/50 px-2.5 py-1 uppercase tracking-wider font-extrabold rounded-sm">
            AI CLASSIFICATION ENGAGED
          </span>
        )}
      </div>

      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center space-y-4">
          <p className="font-mono text-xs text-zinc-400 animate-pulse uppercase tracking-wider">
            [SCANNING DATABASE TELEMETRY FOR VIBES...]
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6 w-full">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="aspect-[2/3] bg-zinc-50 border border-zinc-200 animate-pulse rounded-sm" />
            ))}
          </div>
        </div>
      ) : error ? (
        <Block className="text-center py-12 border-red-200/50 bg-red-50/20">
          <p className="font-mono text-xs text-red-600 uppercase font-black tracking-widest mb-1">
            [ERROR: SEARCH INTERRUPTED]
          </p>
          <p className="text-sm text-zinc-600">{error}</p>
        </Block>
      ) : results.length === 0 ? (
        <Block className="text-center py-16">
          <p className="font-sans font-black text-2xl uppercase tracking-tight text-zinc-800 mb-2">
            No Telemetry Detected
          </p>
          <p className="text-sm text-zinc-500 font-medium max-w-md mx-auto">
            We couldn't resolve any titles matching that {isVibe ? "vibe" : "query"}. Try adjusting your keywords.
          </p>
        </Block>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {results.map((item, index) => {
            const tmdbId = item.id ?? item.tmdbId;
            return (
              <div
                key={`${tmdbId}-${index}`}
                className="relative group rounded-sm overflow-hidden border border-zinc-200 bg-white hover:border-zinc-400 hover:shadow-md transition-all duration-300 ease-out flex flex-col justify-between"
              >
                <Link
                  href={`/media/${item.mediaType}/${tmdbId}`}
                  onMouseEnter={() => sound.play("hover")}
                  onClick={() => sound.play("click")}
                  className="block overflow-hidden flex-1"
                >
                  <div className="aspect-[2/3] relative bg-zinc-100 overflow-hidden">
                    {item.posterPath ? (
                      <Image
                        src={item.posterPath}
                        alt={item.title}
                        fill
                        className="object-cover transition-transform duration-500 ease-out group-hover:scale-102"
                        sizes="20vw"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                        n/a
                      </div>
                    )}
                  </div>
                  
                  <div className="p-3.5 border-t border-zinc-100 flex flex-col gap-1.5">
                    <div className="flex justify-between items-start gap-1">
                      <h3 className="font-sans font-bold text-xs uppercase tracking-wide text-zinc-900 group-hover:text-zinc-950 group-hover:underline decoration-1 underline-offset-2 transition-colors line-clamp-2 leading-snug">
                        {item.title}
                      </h3>
                      <span className={`text-[8px] font-mono font-semibold px-1 py-0.5 border uppercase rounded-sm shrink-0 select-none ${
                        item.mediaType === "tv"
                          ? "bg-[#00E5FF]/10 text-zinc-700 border-[#00E5FF]/20"
                          : "bg-[#FF5722]/10 text-white bg-[#FF5722] border-[#FF5722]/20"
                      }`}>
                        {item.mediaType}
                      </span>
                    </div>

                    {item.releaseYear && (
                      <p className="font-mono text-[9px] text-zinc-400">{item.releaseYear}</p>
                    )}

                    {isVibe && item.relevanceScore !== undefined && (
                      <div className="mt-1 border-t border-dashed border-zinc-200 pt-2 space-y-1">
                        <div className="flex justify-between items-center text-[8px] font-mono">
                          <span className="text-zinc-400 uppercase">RELEVANCE</span>
                          <span className="text-red-600 font-extrabold">{item.relevanceScore * 10}%</span>
                        </div>
                        <p className="font-mono text-[8px] text-red-500 select-none font-bold tracking-tight">
                          {renderGauge(item.relevanceScore)}
                        </p>
                        {item.matchReason && (
                          <p className="text-[9px] text-zinc-500 italic mt-1 leading-relaxed line-clamp-3">
                            "{item.matchReason}"
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </Link>

                <div className="p-3.5 pt-0">
                  <button
                    type="button"
                    onMouseEnter={() => sound.play("hover")}
                    onClick={() => handleAddToVault(item)}
                    className="w-full bg-zinc-900 hover:bg-zinc-800 text-white py-1.5 text-[9px] font-mono font-bold tracking-widest uppercase transition-all duration-200 rounded-sm cursor-pointer select-none"
                  >
                    ADD TO VAULT
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && selectedMedia && (
        <WatchlistModal
          open={modalOpen}
          onClose={() => {
            sound.play("click");
            setModalOpen(false);
            setSelectedMedia(null);
          }}
          media={selectedMedia}
          onSaved={() => {
            window.dispatchEvent(new Event("watchlist-updated"));
          }}
        />
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 font-mono text-xs uppercase tracking-wider text-center text-zinc-400 animate-pulse">
          INITIALIZING SEARCH TELEMETRY LINK...
        </div>
      }
    >
      <SearchResultsContent />
    </Suspense>
  );
}
