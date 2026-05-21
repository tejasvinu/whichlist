"use client";

import { useState, useEffect } from "react";
import { sound } from "@/lib/audio";
import { WatchlistModal } from "./WatchlistModal";

interface Recommendation {
  title: string;
  mediaType: "movie" | "tv";
  reason: string;
  matchScore: number;
}

interface RecommendationPanelProps {
  title: string;
  mediaType: "movie" | "tv";
}

export function RecommendationPanel({ title, mediaType }: RecommendationPanelProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingItem, setAddingItem] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [error, setError] = useState("");

  function renderGauge(score: number) {
    const filled = Math.min(Math.max(Math.round(score / 10), 0), 10);
    const empty = 10 - filled;
    return `[${"█".repeat(filled)}${"░".repeat(empty)}]`;
  }

  useEffect(() => {
    async function fetchRecs() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/ai/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, mediaType }),
        });
        if (!res.ok) throw new Error("Failed to load recommendations");
        const data = await res.json();
        setRecommendations(data.recommendations ?? []);
      } catch (err) {
        setError("Telemetry recommendation link failed.");
      } finally {
        setLoading(false);
      }
    }
    fetchRecs();
  }, [title, mediaType]);

  async function handleAddClick(recTitle: string, recType: "movie" | "tv") {
    sound.play("click");
    setAddingItem(recTitle);
    try {
      const searchRes = await fetch(`/api/search?q=${encodeURIComponent(recTitle)}`);
      if (!searchRes.ok) throw new Error("Search failed");
      const searchData = await searchRes.json();
      
      // Find the first result matching the type, or fallback to first result
      const match = searchData.results?.find((item: any) => item.media_type === recType) || searchData.results?.[0];
      
      if (!match) {
        throw new Error("Item not found on TMDB");
      }

      // Map TMDB search result to WatchlistFormData shape
      setSelectedMedia({
        tmdbId: match.id,
        mediaType: match.media_type as "movie" | "tv",
        title: match.title ?? match.name ?? recTitle,
        posterPath: match.poster_path ? `https://image.tmdb.org/t/p/w500${match.poster_path}` : null,
        releaseYear: match.release_date || match.first_air_date ? new Date(match.release_date || match.first_air_date).getFullYear() : null,
      });
      setModalOpen(true);
    } catch (err) {
      console.error(err);
      alert("Could not load media details from TMDB.");
    } finally {
      setAddingItem(null);
    }
  }

  if (loading) {
    return (
      <div className="border border-zinc-200 bg-white p-6 rounded-sm shadow-sm select-none">
        <p className="font-mono text-[10px] uppercase font-bold text-zinc-400 tracking-wider mb-4">
          SYSTEM SCANNING RELATED TELEMETRY...
        </p>
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-16 bg-zinc-50 border border-zinc-100 animate-pulse rounded-sm" />
          ))}
        </div>
      </div>
    );
  }

  if (error || recommendations.length === 0) {
    return null;
  }

  return (
    <div className="border border-zinc-200 bg-white p-6 rounded-sm shadow-sm">
      <p className="font-sans font-black text-sm uppercase tracking-wider text-zinc-900 border-b border-zinc-100 pb-2.5 mb-4 select-none flex justify-between">
        <span>AI Vector Recommendations</span>
        <span className="font-mono text-[9px] text-red-600 font-extrabold uppercase">[RECOMMENDATION ENGINE]</span>
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {recommendations.map((rec, index) => (
          <div
            key={index}
            className="border border-zinc-100 hover:border-zinc-300 p-4 bg-zinc-50/20 rounded-sm flex flex-col justify-between transition-colors duration-200 group"
          >
            <div>
              <div className="flex justify-between items-start gap-2 mb-1">
                <p className="font-sans font-black text-xs uppercase tracking-wide text-zinc-800 group-hover:text-zinc-950 transition-colors leading-snug">
                  {rec.title}
                </p>
                <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 border uppercase rounded-sm select-none ${
                  rec.mediaType === "tv"
                    ? "bg-[#00E5FF]/10 text-zinc-700 border-[#00E5FF]/20"
                    : "bg-[#FF5722]/10 text-zinc-700 border-[#FF5722]/20"
                }`}>
                  {rec.mediaType}
                </span>
              </div>
              <div className="mt-2 space-y-1">
                <div className="flex justify-between items-center text-[8px] font-mono select-none">
                  <span className="text-zinc-400 uppercase">RELEVANCE</span>
                  <span className="text-red-600 font-extrabold">{rec.matchScore}%</span>
                </div>
                <p className="font-mono text-[8px] text-red-500 font-bold select-none tracking-tight">
                  {renderGauge(rec.matchScore)}
                </p>
              </div>
              <p className="text-[10px] text-zinc-500 italic mt-2.5 leading-relaxed">
                "{rec.reason}"
              </p>
            </div>

            <button
              type="button"
              disabled={addingItem === rec.title}
              onMouseEnter={() => sound.play("hover")}
              onClick={() => handleAddClick(rec.title, rec.mediaType)}
              className="mt-4 w-full bg-white hover:bg-zinc-900 hover:text-white border border-zinc-200 hover:border-zinc-900 text-zinc-700 py-1.5 text-[9px] font-mono font-bold tracking-widest uppercase transition-all duration-200 rounded-sm cursor-pointer disabled:opacity-50 select-none"
            >
              {addingItem === rec.title ? "LOCATING..." : "ADD TO LIST"}
            </button>
          </div>
        ))}
      </div>

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
            // Trigger global reload event so layout knows updates happened
            window.dispatchEvent(new Event("watchlist-updated"));
          }}
        />
      )}
    </div>
  );
}
