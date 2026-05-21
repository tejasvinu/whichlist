"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { sound } from "@/lib/audio";
import { WatchlistModal } from "./WatchlistModal";

interface RecommendedItem {
  tmdbId: number;
  title: string;
  mediaType: "movie" | "tv";
  posterPath: string | null;
  releaseYear: number | null;
  reason: string;
}

interface QuickStartPanelProps {
  onItemAdded: () => void;
  existingItemIds: number[];
}

export function QuickStartPanel({ onItemAdded, existingItemIds }: QuickStartPanelProps) {
  const [recommendations, setRecommendations] = useState<RecommendedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<RecommendedItem | null>(null);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const [notInterestedIds, setNotInterestedIds] = useState<Set<number>>(new Set());
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [error, setError] = useState("");

  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
    setError("");
    setTerminalLogs(["SYSTEM: INITIALIZING GEMINI COGNITIVE CORE..."]);

    const logTemplates = [
      "DB: FETCHING ACTIVE WATCHLIST TELEMETRY...",
      "GEMINI: PARSING CINEMATIC TASTE VECTORS...",
      "GEMINI: COMPILING 10 OPTIMAL RECOMMENDATION UNITS...",
      "TMDB: RESOLVING METADATA & COVER ARTWORK...",
      "SYSTEM: GENERATING EDITORIAL CRITIQUES...",
      "SYSTEM: TELEMETRY COMPILE COMPLETE. RENDERING SUGGESTIONS."
    ];

    let currentIdx = 0;
    const interval = setInterval(() => {
      if (currentIdx < logTemplates.length) {
        setTerminalLogs((prev) => [...prev, logTemplates[currentIdx]]);
        currentIdx++;
      } else {
        clearInterval(interval);
      }
    }, 450);

    try {
      const res = await fetch("/api/ai/quick-start", { method: "POST" });
      if (!res.ok) {
        throw new Error("Failed to load recommendations");
      }
      const data = await res.json();
      setRecommendations(data.recommendations ?? []);
      sound.play("success");
    } catch (err) {
      console.error(err);
      setError("FAILED TO ESTABLISH LINK TO RECOMMENDATION ENGINE. VERIFY API KEY.");
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  function handleAddClick(item: RecommendedItem) {
    sound.play("click");
    setSelectedMedia(item);
    setModalOpen(true);
  }

  async function handleAddUnwatched(item: RecommendedItem) {
    sound.play("click");
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdbId: item.tmdbId,
          mediaType: item.mediaType,
          title: item.title,
          posterPath: item.posterPath,
          releaseYear: item.releaseYear,
          status: "Plan to Watch",
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to add to watchlist");
      }

      setAddedIds((prev) => {
        const next = new Set(prev);
        next.add(item.tmdbId);
        return next;
      });
      sound.play("success");
      onItemAdded();
    } catch (err) {
      console.error(err);
      alert("Failed to add item.");
    }
  }

  async function handleNotInterested(item: RecommendedItem) {
    sound.play("click");
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdbId: item.tmdbId,
          mediaType: item.mediaType,
          title: item.title,
          posterPath: item.posterPath,
          releaseYear: item.releaseYear,
          status: "Dropped",
          tags: ["not-interested"],
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to flag as not interested");
      }

      setNotInterestedIds((prev) => {
        const next = new Set(prev);
        next.add(item.tmdbId);
        return next;
      });
      sound.play("success");
      onItemAdded();
    } catch (err) {
      console.error(err);
      alert("Failed to flag item.");
    }
  }

  const getStatusBadgeStyle = (mediaType: "movie" | "tv") => {
    return mediaType === "tv"
      ? "bg-[#00E5FF] text-zinc-950 border-[#00E5FF]/30"
      : "bg-[#FF5722] text-white border-[#FF5722]/30";
  };

  if (loading) {
    return (
      <div className="bg-zinc-950 text-emerald-400 font-mono text-[10px] p-6 border border-zinc-800 rounded-sm shadow-inner space-y-1.5 h-64 overflow-y-auto w-full select-none">
        <div className="flex justify-between border-b border-zinc-800 pb-1.5 mb-1.5 text-zinc-500 font-bold">
          <span>RECOMMENDATION LOADER ENGINE v2.0</span>
          <span className="animate-pulse">STATUS: RESOLVING COGNITIVE VECTOR...</span>
        </div>
        {terminalLogs.map((log, idx) => (
          <div key={idx} className="leading-relaxed flex items-start gap-1">
            <span className="text-zinc-600 shrink-0">[{new Date().toLocaleTimeString()}]</span>
            <span className="break-all">{log}</span>
          </div>
        ))}
        <div className="animate-pulse flex items-center gap-1 mt-0.5">
          <span className="text-zinc-600">[{new Date().toLocaleTimeString()}]</span>
          <span>_</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-white border border-red-200 text-center rounded-sm select-none">
        <p className="font-mono text-xs text-red-600 font-extrabold uppercase mb-2">[CRITICAL ERROR]: {error}</p>
        <button
          type="button"
          onClick={fetchRecommendations}
          className="bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 px-3 py-1 font-mono text-[9px] uppercase tracking-widest text-zinc-600 rounded-sm cursor-pointer"
        >
          RETRY LINK
        </button>
      </div>
    );
  }

  return (
    <div className="border border-zinc-200 bg-white p-6 rounded-sm shadow-sm select-none animate-fade-in space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-zinc-100 pb-4">
        <div>
          <p className="text-[9px] font-mono font-bold tracking-widest text-red-600 uppercase flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>
            MODULE 03 // POPULATE LIBRARY WITH AI
          </p>
          <h2 className="font-sans font-black text-xl md:text-2xl uppercase tracking-tighter text-zinc-900 mt-1">
            AI Taste Starter Pack
          </h2>
          <p className="text-xs text-zinc-500 font-medium mt-1">
            Select titles to populate your curated watchlist. Hit refresh to compute 10 new titles based on your latest additions.
          </p>
        </div>
        <div className="flex gap-2 shrink-0 self-start sm:self-center">
          <Link
            href="/library"
            onClick={() => sound.play("click")}
            className="bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 px-4 py-2 text-[10px] font-mono font-bold tracking-widest uppercase rounded-sm cursor-pointer select-none transition-all duration-200 flex items-center justify-center font-semibold"
          >
            VIEW MY LIST
          </Link>
          <button
            type="button"
            onClick={() => {
              sound.play("click");
              fetchRecommendations();
            }}
            className="bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 text-[10px] font-mono font-bold tracking-widest uppercase rounded-sm border border-zinc-900 cursor-pointer shadow-md select-none transition-all duration-200 shrink-0"
          >
            REFRESH SUGGESTIONS
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
        {recommendations
          .filter((item) => !notInterestedIds.has(item.tmdbId))
          .map((item) => {
            const isAdded = addedIds.has(item.tmdbId) || existingItemIds.includes(item.tmdbId);
          return (
            <div
              key={item.tmdbId}
              className={`relative flex flex-col justify-between border rounded-sm overflow-hidden bg-white hover:shadow-md transition-all duration-300 ${
                isAdded ? "border-zinc-300 opacity-60 bg-zinc-50/40" : "border-zinc-200 hover:border-zinc-400"
              }`}
            >
              <div>
                <div className="aspect-[2/3] relative bg-zinc-100 overflow-hidden">
                  {item.posterPath ? (
                    <Image
                      src={item.posterPath}
                      alt={item.title}
                      fill
                      className="object-cover"
                      sizes="15vw"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                      no image
                    </div>
                  )}

                  <div className="absolute top-2 left-2 flex gap-1.5 select-none">
                    <span className={`text-[8px] font-mono font-semibold px-2 py-0.5 border uppercase rounded-sm ${getStatusBadgeStyle(item.mediaType)}`}>
                      {item.mediaType}
                    </span>
                    {item.releaseYear && (
                      <span className="text-[8px] font-mono bg-zinc-950/80 text-white px-1.5 py-0.5 border border-zinc-800/80 rounded-sm">
                        {item.releaseYear}
                      </span>
                    )}
                  </div>

                  {!isAdded && (
                    <button
                      type="button"
                      title="Not Interested"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNotInterested(item);
                      }}
                      className="absolute top-2 right-2 bg-zinc-950/85 hover:bg-red-600 text-white w-5 h-5 flex items-center justify-center border border-zinc-800/80 rounded-sm cursor-pointer select-none transition-all duration-200 font-sans text-[10px] font-bold z-10"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="p-3.5 space-y-2">
                  <h3 className="font-sans font-bold text-xs uppercase tracking-wide text-zinc-900 leading-snug line-clamp-2" title={item.title}>
                    {item.title}
                  </h3>
                  <p className="text-[10px] text-zinc-500 font-medium italic leading-relaxed line-clamp-4">
                    "{item.reason}"
                  </p>
                </div>
              </div>

              <div className="p-3.5 pt-0">
                {isAdded ? (
                  <div className="w-full bg-zinc-100 border border-zinc-200 text-zinc-400 py-1.5 text-[9px] font-mono font-bold tracking-widest uppercase text-center rounded-sm">
                    ✓ IN LIBRARY
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleAddUnwatched(item)}
                      className="flex-1 bg-white hover:bg-zinc-900 hover:text-white border border-zinc-200 hover:border-zinc-900 text-zinc-700 py-1.5 text-[9px] font-mono font-bold tracking-widest uppercase transition-all duration-200 rounded-sm cursor-pointer font-semibold"
                      title="Quick add to Watchlist as Plan to Watch"
                    >
                      + UNWATCHED
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddClick(item)}
                      className="flex-1 bg-white hover:bg-zinc-900 hover:text-white border border-zinc-200 hover:border-zinc-900 text-zinc-700 py-1.5 text-[9px] font-mono font-bold tracking-widest uppercase transition-all duration-200 rounded-sm cursor-pointer font-semibold"
                      title="Add to Watchlist and rate/review"
                    >
                      + WATCHED
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {modalOpen && selectedMedia && (
        <WatchlistModal
          open={modalOpen}
          onClose={() => {
            sound.play("click");
            setModalOpen(false);
            setSelectedMedia(null);
          }}
          media={{
            tmdbId: selectedMedia.tmdbId,
            mediaType: selectedMedia.mediaType,
            title: selectedMedia.title,
            posterPath: selectedMedia.posterPath,
            releaseYear: selectedMedia.releaseYear,
          }}
          onSaved={() => {
            setAddedIds((prev) => {
              const next = new Set(prev);
              next.add(selectedMedia.tmdbId);
              return next;
            });
            setModalOpen(false);
            setSelectedMedia(null);
            onItemAdded();
          }}
        />
      )}
    </div>
  );
}
