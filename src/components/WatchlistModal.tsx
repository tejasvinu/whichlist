"use client";

import { useState, useEffect } from "react";
import { WATCH_STATUSES, type WatchStatus } from "@/lib/constants";
import { sound } from "@/lib/audio";

export interface WatchlistFormData {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  releaseYear: number | null;
}

interface WatchlistModalProps {
  open: boolean;
  onClose: () => void;
  media: WatchlistFormData;
  existingItem?: {
    _id: string;
    status: WatchStatus;
    rating?: number;
    review?: string;
    tags?: string[];
  } | null;
  onSaved: () => void;
}

export function WatchlistModal({
  open,
  onClose,
  media,
  existingItem,
  onSaved,
}: WatchlistModalProps) {
  const [status, setStatus] = useState<WatchStatus>("Plan to Watch");
  const [rating, setRating] = useState<string>("");
  const [review, setReview] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatingTags, setGeneratingTags] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (existingItem) {
      setStatus(existingItem.status);
      setRating(existingItem.rating?.toString() ?? "");
      setReview(existingItem.review ?? "");
      setTags(existingItem.tags ?? []);
    } else {
      setStatus("Plan to Watch");
      setRating("");
      setReview("");
      setTags([]);
    }
  }, [existingItem, open]);

  if (!open) return null;

  async function handleAutoTag() {
    if (!review.trim()) return;
    setGeneratingTags(true);
    setError("");
    try {
      const res = await fetch("/api/ai/auto-tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: media.title,
          mediaType: media.mediaType,
          review,
        }),
      });
      if (!res.ok) {
        throw new Error("Failed to auto-tag. Make sure GEMINI_API_KEY is configured.");
      }
      const data = await res.json();
      const merged = Array.from(new Set([...tags, ...(data.tags ?? [])]));
      setTags(merged);
      sound.play("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auto-tagging failed");
    } finally {
      setGeneratingTags(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const payload = {
      status,
      rating: rating ? parseInt(rating, 10) : null,
      review: review || undefined,
      tags,
    };

    try {
      if (existingItem) {
        const res = await fetch(`/api/watchlist/${existingItem._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Update failed");
      } else {
        const res = await fetch("/api/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...media,
            ...payload,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Failed to add");
        }
      }
      sound.play("success");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!existingItem || !confirm("Remove from list?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/watchlist/${existingItem._id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      sound.play("trash");
      onSaved();
      onClose();
    } catch {
      setError("Failed to delete");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/45 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-white border border-zinc-200 shadow-2xl rounded-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-100 bg-zinc-50 text-zinc-500 flex justify-between items-center select-none">
          <span className="font-sans font-extrabold text-[10px] tracking-widest uppercase">
            {existingItem ? "Update List Entry" : "Add to List"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-950 font-mono text-xs transition-colors cursor-pointer"
          >
            [close]
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <p className="font-sans font-black text-lg uppercase tracking-tight text-zinc-900 leading-tight">
            {media.title}
          </p>

          <div>
            <label className="block text-[9px] font-mono font-bold uppercase mb-2.5 tracking-widest text-zinc-400 select-none">Status</label>
            <div className="grid grid-cols-2 gap-2">
              {WATCH_STATUSES.map((s) => {
                const isSelected = status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onMouseEnter={() => sound.play("hover")}
                    onClick={() => {
                      sound.play("click");
                      setStatus(s);
                    }}
                    className={`py-2 px-3 border font-sans font-bold uppercase text-[10px] tracking-wide text-left transition-all duration-200 flex items-center justify-between cursor-pointer rounded-sm ${
                      isSelected
                        ? "bg-zinc-900 border-zinc-900 text-white shadow-sm"
                        : "bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:border-zinc-300"
                    }`}
                  >
                    <span>{s}</span>
                    <span className="text-[8px] opacity-75">{isSelected ? "●" : "○"}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-[9px] font-mono font-bold uppercase mb-2.5 tracking-widest text-zinc-400 select-none">
              Rating (1-10, optional)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                const isSelected = rating === num.toString();
                return (
                  <button
                    key={num}
                    type="button"
                    onMouseEnter={() => sound.play("hover")}
                    onClick={() => {
                      sound.play("click");
                      setRating(isSelected ? "" : num.toString());
                    }}
                    className={`w-8.5 h-8.5 border font-mono font-bold text-xs flex items-center justify-center transition-all duration-200 cursor-pointer rounded-sm ${
                      isSelected
                        ? num === 1
                          ? "bg-red-600 border-red-600 text-white shadow-sm shadow-red-500/20"
                          : "bg-zinc-900 border-zinc-900 text-white shadow-sm shadow-zinc-800/20"
                        : "bg-zinc-50 border-zinc-200 text-zinc-500 hover:bg-zinc-100 hover:border-zinc-300"
                    }`}
                  >
                    {num}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-[9px] font-mono font-bold uppercase mb-1.5 tracking-widest text-zinc-400 select-none">
              Review (optional)
            </label>
            <textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              rows={4}
              className="w-full border border-zinc-200 p-3 bg-zinc-50/50 font-sans text-xs tracking-wide leading-relaxed rounded-sm focus:outline-none focus:bg-white focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-all duration-200 resize-none text-zinc-800"
              placeholder="Enter your notes..."
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5 select-none">
              <label className="text-[9px] font-mono font-bold uppercase tracking-widest text-zinc-400">
                Tags (optional)
              </label>
              {review.trim() && (
                <button
                  type="button"
                  onClick={handleAutoTag}
                  disabled={generatingTags}
                  className="bg-red-50 hover:bg-red-100 text-red-600 px-2 py-0.5 text-[9px] font-mono font-bold border border-red-100/50 uppercase rounded-sm cursor-pointer disabled:opacity-50 select-none animate-pulse"
                >
                  {generatingTags ? "AUTO-TAGGING..." : "AUTO-TAG WITH AI"}
                </button>
              )}
            </div>
            
            <div className="flex flex-wrap gap-1 mb-2.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="bg-zinc-100 text-zinc-800 text-[9px] font-mono px-2 py-0.5 rounded-sm border border-zinc-200 flex items-center gap-1.5 uppercase select-none"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => setTags(tags.filter((t) => t !== tag))}
                    className="text-zinc-400 hover:text-red-500 font-bold font-mono cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              ))}
              {tags.length === 0 && (
                <span className="text-[9px] font-mono text-zinc-400 italic">No tags applied.</span>
              )}
            </div>

            <input
              type="text"
              placeholder="ADD CUSTOM TAG... [Press Enter]"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const val = e.currentTarget.value.trim();
                  if (val && !tags.includes(val)) {
                    setTags([...tags, val]);
                    e.currentTarget.value = "";
                    sound.play("click");
                  }
                }
              }}
              className="w-full border border-zinc-200 px-3 py-2 bg-zinc-50/50 font-sans text-xs tracking-wide rounded-sm focus:outline-none focus:bg-white focus:border-zinc-400 transition-all duration-200 text-zinc-800 uppercase"
            />
          </div>

          {error && (
            <p className="text-red-600 text-xs font-mono tracking-wider uppercase bg-red-50 border border-red-100 p-2 rounded-sm select-none">
              [error]: {error}
            </p>
          )}

          <div className="flex gap-2.5 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-zinc-900 text-white py-3 font-sans font-bold text-xs tracking-widest uppercase hover:bg-zinc-800 border border-transparent transition-all duration-200 disabled:opacity-50 shadow-md shadow-zinc-950/10 cursor-pointer rounded-sm"
            >
              {loading ? "Saving..." : existingItem ? "Update" : "Add to List"}
            </button>
            {existingItem && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="px-4.5 bg-red-50 text-red-600 border border-red-100 font-sans font-bold text-xs tracking-widest uppercase hover:bg-red-600 hover:text-white hover:border-red-600 transition-all duration-200 disabled:opacity-50 cursor-pointer rounded-sm"
              >
                Delete
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
