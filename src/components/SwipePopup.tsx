"use client";

import { DeckCardItem } from "./SwipeCard";
import { sound } from "@/lib/audio";

interface SwipePopupProps {
  open: boolean;
  card: DeckCardItem | null;
  onClose: () => void;
  onMarkWatched: () => void;
  onMarkNever: () => void;
  onViewDetails: () => void;
}

export function SwipePopup({
  open,
  card,
  onClose,
  onMarkWatched,
  onMarkNever,
  onViewDetails,
}: SwipePopupProps) {
  if (!open || !card) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="swipe-popup-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white border border-zinc-200 shadow-2xl rounded-sm overflow-hidden text-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-zinc-100 bg-zinc-50 text-zinc-500 flex justify-between items-center select-none">
          <span className="font-mono font-bold text-[10px] tracking-widest uppercase text-zinc-500">
            OPTIONS // {card.mediaType === "movie" ? "FILM" : "TV"}
          </span>
          <button
            type="button"
            onClick={() => {
              sound.play("click");
              onClose();
            }}
            className="text-zinc-400 hover:text-zinc-950 font-mono text-xs cursor-pointer transition-colors"
          >
            [CLOSE]
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div>
            <h3
              id="swipe-popup-title"
              className="font-sans font-black text-xl uppercase tracking-tight text-zinc-900 leading-tight"
            >
              {card.title}
            </h3>
            <p className="font-mono text-[10px] text-zinc-400 tracking-wider uppercase mt-1">
              {card.releaseYear ?? "N/A"} · {card.matchPercentage ? `MATCH ${card.matchPercentage}%` : "POPULAR"}
            </p>
          </div>

          <div className="space-y-2 pt-1">
            {/* Mark Watched & Rate */}
            <button
              type="button"
              onMouseEnter={() => sound.play("hover")}
              onClick={() => {
                sound.play("click");
                onMarkWatched();
              }}
              className="w-full text-left p-3.5 border border-zinc-200 bg-zinc-50 hover:bg-zinc-900 hover:text-white hover:border-zinc-900 rounded-sm transition-all duration-200 group cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="font-sans font-bold text-xs uppercase tracking-wide">
                  Mark Watched & Rate
                </span>
                <span className="font-mono text-xs opacity-60 group-hover:opacity-100">
                  ★
                </span>
              </div>
              <p className="font-mono text-[10px] text-zinc-500 group-hover:text-zinc-300 mt-0.5">
                Add to Completed with rating, notes & tags
              </p>
            </button>

            {/* View Full Details */}
            <button
              type="button"
              onMouseEnter={() => sound.play("hover")}
              onClick={() => {
                sound.play("click");
                onViewDetails();
              }}
              className="w-full text-left p-3.5 border border-zinc-200 bg-zinc-50 hover:bg-zinc-900 hover:text-white hover:border-zinc-900 rounded-sm transition-all duration-200 group cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="font-sans font-bold text-xs uppercase tracking-wide">
                  View Full Details
                </span>
                <span className="font-mono text-xs opacity-60 group-hover:opacity-100">
                  →
                </span>
              </div>
              <p className="font-mono text-[10px] text-zinc-500 group-hover:text-zinc-300 mt-0.5">
                Inspect synopsis, cast, trailers & metadata
              </p>
            </button>

            {/* Never Show Again */}
            <button
              type="button"
              onMouseEnter={() => sound.play("hover")}
              onClick={() => {
                sound.play("trash");
                onMarkNever();
              }}
              className="w-full text-left p-3.5 border border-red-200 bg-red-50/50 hover:bg-red-600 hover:text-white hover:border-red-600 rounded-sm transition-all duration-200 group cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="font-sans font-bold text-xs uppercase tracking-wide text-red-700 group-hover:text-white">
                  Never Show Again
                </span>
                <span className="font-mono text-xs text-red-500 group-hover:text-white">
                  ✕
                </span>
              </div>
              <p className="font-mono text-[10px] text-red-600/80 group-hover:text-red-100 mt-0.5">
                Permanently dismiss and adjust taste profile
              </p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
