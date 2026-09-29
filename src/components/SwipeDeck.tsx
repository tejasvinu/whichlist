"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { SwipeCard, DeckCardItem, SwipeCardHandle } from "./SwipeCard";
import { SwipePopup } from "./SwipePopup";
import { WatchlistModal } from "./WatchlistModal";
import { sound } from "@/lib/audio";
import { posterUrl } from "@/lib/tmdb";

interface SwipeHistoryEntry {
  card: DeckCardItem;
  action: "like" | "pass" | "watched" | "never";
}

export function SwipeDeck() {
  const [cards, setCards] = useState<DeckCardItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const isPrefetchingRef = useRef(false);
  const [page, setPage] = useState(1);
  const [history, setHistory] = useState<SwipeHistoryEntry[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  // Modals state
  const [popupOpen, setPopupOpen] = useState(false);
  const [detailsCard, setDetailsCard] = useState<DeckCardItem | null>(null);
  const [ratingCard, setRatingCard] = useState<DeckCardItem | null>(null);

  const topCardRef = useRef<SwipeCardHandle | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  }, []);

  // 1. Initial deck fetch
  useEffect(() => {
    let active = true;
    async function loadInitial() {
      try {
        const res = await fetch("/api/discover/deck?page=1");
        if (!res.ok) throw new Error("Failed to load deck");
        const data = await res.json();
        const newItems: DeckCardItem[] = data.items || [];
        if (active) {
          setCards(newItems);
          setPage(1);
        }
      } catch (err) {
        console.error("Deck load error:", err);
        if (active) {
          showToast("Failed to load discover deck. Please refresh.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    loadInitial();

    return () => {
      active = false;
    };
  }, [showToast]);

  // Manual load more triggered by user action
  const loadMoreDeck = useCallback(
    async (pageNum: number) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/discover/deck?page=${pageNum}`);
        if (!res.ok) throw new Error("Failed to load deck");
        const data = await res.json();
        const newItems: DeckCardItem[] = data.items || [];
        setCards((prev) => {
          const existingKeys = new Set(prev.map((c) => `${c.mediaType}-${c.tmdbId}`));
          const filteredNew = newItems.filter(
            (c) => !existingKeys.has(`${c.mediaType}-${c.tmdbId}`)
          );
          return [...prev, ...filteredNew];
        });
        setPage(pageNum);
      } catch (err) {
        console.error("Deck load error:", err);
        showToast("Failed to load discover deck. Please refresh.");
      } finally {
        setLoading(false);
      }
    },
    [showToast]
  );

  // 2. Prefetch next batch asynchronously when <= 4 cards remain
  const remainingCount = cards.length - currentIndex;
  useEffect(() => {
    if (loading || isPrefetchingRef.current || remainingCount > 4 || remainingCount <= 0) {
      return;
    }

    let active = true;
    isPrefetchingRef.current = true;

    async function prefetch() {
      try {
        const nextPage = page + 1;
        const res = await fetch(`/api/discover/deck?page=${nextPage}`);
        if (!res.ok) return;
        const data = await res.json();
        const newItems: DeckCardItem[] = data.items || [];
        if (active) {
          setCards((prev) => {
            const existingKeys = new Set(prev.map((c) => `${c.mediaType}-${c.tmdbId}`));
            const filteredNew = newItems.filter(
              (c) => !existingKeys.has(`${c.mediaType}-${c.tmdbId}`)
            );
            return [...prev, ...filteredNew];
          });
          setPage(nextPage);
        }
      } catch (err) {
        console.error("Prefetch error:", err);
      } finally {
        isPrefetchingRef.current = false;
      }
    }
    prefetch();

    return () => {
      active = false;
    };
  }, [loading, remainingCount, page]);

  // 3. Preload next 3 card poster images
  useEffect(() => {
    const nextBatch = cards.slice(currentIndex, currentIndex + 4);
    nextBatch.forEach((c) => {
      if (c.posterPath && typeof window !== "undefined") {
        const img = new window.Image();
        const url = posterUrl(c.posterPath, "w500");
        if (url) img.src = url;
      }
    });
  }, [cards, currentIndex]);

  // 4. Handle swipe commitment
  const handleSwipe = useCallback(
    async (direction: "left" | "right" | "up") => {
      if (currentIndex >= cards.length) return;
      const card = cards[currentIndex];
      const action =
        direction === "right" ? "like" : direction === "up" ? "watched" : "pass";

      // Advance deck immediately
      setCurrentIndex((prev) => prev + 1);
      setHistory((prev) => [{ card, action }, ...prev]);

      const actionText =
        action === "like"
          ? `Added "${card.title}" to Watchlist`
          : action === "watched"
          ? `Marked "${card.title}" as Watched`
          : `Passed "${card.title}"`;

      setAnnouncement(actionText);
      showToast(actionText);

      // Fire and forget API call
      try {
        const res = await fetch("/api/discover/swipe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tmdbId: card.tmdbId,
            mediaType: card.mediaType,
            action,
            position: currentIndex,
            source: card.source || "trending",
            itemSnapshot: {
              title: card.title,
              posterPath: card.posterPath,
              releaseYear: card.releaseYear,
            },
          }),
        });

        if (res.ok) {
          window.dispatchEvent(new CustomEvent("watchlist-updated"));
        }
      } catch (err) {
        console.error("Failed to commit swipe:", err);
      }
    },
    [cards, currentIndex, showToast]
  );

  // 5. Handle "Never" action from popup
  const handleMarkNever = useCallback(async () => {
    if (currentIndex >= cards.length) return;
    const card = cards[currentIndex];
    setPopupOpen(false);

    setCurrentIndex((prev) => prev + 1);
    setHistory((prev) => [{ card, action: "never" }, ...prev]);

    const actionText = `Permanently dismissed "${card.title}"`;
    setAnnouncement(actionText);
    showToast(actionText);

    try {
      const res = await fetch("/api/discover/swipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdbId: card.tmdbId,
          mediaType: card.mediaType,
          action: "never",
          position: currentIndex,
          source: card.source || "trending",
          itemSnapshot: {
            title: card.title,
            posterPath: card.posterPath,
            releaseYear: card.releaseYear,
          },
        }),
      });

      if (res.ok) {
        window.dispatchEvent(new CustomEvent("watchlist-updated"));
      }
    } catch (err) {
      console.error("Failed to dismiss item:", err);
    }
  }, [cards, currentIndex, showToast]);

  // 6. Handle Undo
  const handleUndo = useCallback(async () => {
    if (history.length === 0 || currentIndex <= 0) return;

    sound.play("click");
    try {
      const res = await fetch("/api/discover/undo", { method: "POST" });
      if (!res.ok) throw new Error("Undo failed");

      const lastEntry = history[0];
      setHistory((prev) => prev.slice(1));
      setCurrentIndex((prev) => Math.max(0, prev - 1));

      const restoreText = `Restored "${lastEntry.card.title}"`;
      setAnnouncement(restoreText);
      showToast(restoreText);
      window.dispatchEvent(new CustomEvent("watchlist-updated"));
    } catch (err) {
      console.error("Undo error:", err);
      showToast("Unable to undo action");
    }
  }, [history, currentIndex, showToast]);

  // 7. Desktop Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if focus is in an input or textarea or modal is open
      if (
        popupOpen ||
        detailsCard ||
        ratingCard ||
        ["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)
      ) {
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        topCardRef.current?.swipe("right");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        topCardRef.current?.swipe("left");
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        topCardRef.current?.swipe("up");
      } else if (e.key === "u" || e.key === "U" || e.key === "Backspace") {
        e.preventDefault();
        handleUndo();
      } else if (e.key === "Enter" && cards[currentIndex]) {
        e.preventDefault();
        setDetailsCard(cards[currentIndex]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [popupOpen, detailsCard, ratingCard, cards, currentIndex, handleUndo]);

  const activeCard = cards[currentIndex] || null;
  const visibleCards = cards.slice(currentIndex, currentIndex + 3);

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-[720px] select-none py-2 relative">
      {/* Aria Live Announcement Region */}
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>

      {/* Undo / Status Toast */}
      {toastMessage && (
        <div className="fixed top-24 z-50 animate-fade-in flex items-center gap-3 bg-zinc-950/90 text-white px-4 py-2.5 rounded-sm border border-zinc-800 shadow-2xl backdrop-blur-md font-mono text-xs">
          <span>{toastMessage}</span>
          {history.length > 0 && (
            <button
              type="button"
              onClick={handleUndo}
              className="text-[#39FF14] hover:underline font-bold uppercase tracking-wider cursor-pointer ml-2"
            >
              [UNDO]
            </button>
          )}
        </div>
      )}

      {/* Main Deck Container */}
      <div className="relative w-full max-w-[380px] md:max-w-[420px] h-[560px] md:h-[620px] flex items-center justify-center">
        {loading ? (
          <div className="w-full h-full border-2 border-zinc-200 bg-white rounded-md flex flex-col items-center justify-center p-6 space-y-4">
            <div className="w-10 h-10 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
            <p className="font-mono text-xs uppercase tracking-widest text-zinc-500 animate-pulse">
              CALIBRATING DISCOVERY FEED...
            </p>
          </div>
        ) : visibleCards.length === 0 ? (
          /* Empty / Caught Up State */
          <div className="w-full h-full border-2 border-zinc-200 bg-white rounded-md flex flex-col items-center justify-center p-8 text-center space-y-6 shadow-sm">
            <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 font-mono text-xl">
              ✓
            </div>
            <div>
              <h3 className="font-sans font-black text-2xl uppercase tracking-tight text-zinc-900">
                You&apos;re All Caught Up
              </h3>
              <p className="font-sans text-xs text-zinc-500 mt-2 max-w-xs leading-relaxed">
                You have reviewed all current candidates. Fetch the next batch or inspect your watchlist.
              </p>
            </div>
            <div className="flex flex-col w-full gap-2.5 pt-2">
              <button
                type="button"
                onMouseEnter={() => sound.play("hover")}
                onClick={() => {
                  sound.play("click");
                  loadMoreDeck(page + 1);
                }}
                className="w-full py-3 bg-zinc-900 text-white font-sans font-bold text-xs uppercase tracking-widest hover:bg-zinc-800 transition-colors rounded-sm cursor-pointer shadow-sm"
              >
                LOAD MORE CANDIDATES
              </button>
              {history.length > 0 && (
                <button
                  type="button"
                  onMouseEnter={() => sound.play("hover")}
                  onClick={handleUndo}
                  className="w-full py-2.5 bg-zinc-100 border border-zinc-200 text-zinc-700 font-sans font-bold text-xs uppercase tracking-widest hover:bg-zinc-200 transition-colors rounded-sm cursor-pointer"
                >
                  UNDO LAST SWIPE
                </button>
              )}
              <Link
                href="/library"
                onMouseEnter={() => sound.play("hover")}
                onClick={() => sound.play("click")}
                className="w-full py-2.5 border border-zinc-200 text-zinc-600 font-sans font-bold text-xs uppercase tracking-widest hover:bg-zinc-50 text-center transition-colors rounded-sm cursor-pointer"
              >
                VIEW MY LIST
              </Link>
            </div>
          </div>
        ) : (
          /* Deck Cards Stack (Top 3 rendered in reverse order for correct DOM layering) */
          visibleCards
            .slice()
            .reverse()
            .map((card, reverseIdx) => {
              const actualStackIdx = visibleCards.length - 1 - reverseIdx;
              const isTop = actualStackIdx === 0;

              return (
                <SwipeCard
                  key={`${card.mediaType}-${card.tmdbId}`}
                  ref={isTop ? topCardRef : undefined}
                  card={card}
                  isTop={isTop}
                  stackIndex={actualStackIdx}
                  onSwipe={handleSwipe}
                  onLongPress={() => {
                    setPopupOpen(true);
                  }}
                  onTap={() => {
                    setDetailsCard(card);
                  }}
                />
              );
            })
        )}
      </div>

      {/* Deck Controls (Desktop & Mobile Touch Buttons) */}
      {visibleCards.length > 0 && (
        <div className="flex items-center justify-center gap-4 md:gap-6 mt-6 md:mt-8">
          {/* Undo Button */}
          <button
            type="button"
            disabled={history.length === 0}
            onMouseEnter={() => sound.play("hover")}
            onClick={handleUndo}
            title="Undo last swipe (U)"
            className="w-11 h-11 md:w-12 md:h-12 rounded-full border border-zinc-300 bg-white text-zinc-600 hover:text-zinc-950 hover:border-zinc-400 hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:outline-none transition-all flex items-center justify-center cursor-pointer shadow-sm disabled:opacity-30 disabled:cursor-not-allowed text-base font-mono"
          >
            ⟲
          </button>

          {/* Pass (Left) Button */}
          <button
            type="button"
            onMouseEnter={() => sound.play("hover")}
            onClick={() => {
              topCardRef.current?.swipe("left");
            }}
            title="Pass (Left Arrow)"
            className="w-14 h-14 md:w-16 md:h-16 rounded-full border-2 border-zinc-200 bg-white text-zinc-400 hover:text-red-600 hover:border-red-600 hover:bg-red-50/50 focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:outline-none transition-all duration-200 flex items-center justify-center cursor-pointer shadow-md text-2xl font-bold group"
          >
            <span className="transform group-hover:scale-110 transition-transform">✕</span>
          </button>

          {/* Seen / Completed (Up) Button */}
          <button
            type="button"
            onMouseEnter={() => sound.play("hover")}
            onClick={() => {
              topCardRef.current?.swipe("up");
            }}
            title="Mark Watched (Up Arrow)"
            className="w-12 h-12 md:w-14 md:h-14 rounded-full border-2 border-zinc-200 bg-white text-zinc-400 hover:text-blue-600 hover:border-blue-600 hover:bg-blue-50/50 focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:outline-none transition-all duration-200 flex items-center justify-center cursor-pointer shadow-md text-xl font-bold group"
          >
            <span className="transform group-hover:scale-110 transition-transform">↑</span>
          </button>

          {/* Want (Right) Button */}
          <button
            type="button"
            onMouseEnter={() => sound.play("hover")}
            onClick={() => {
              topCardRef.current?.swipe("right");
            }}
            title="Add to Watchlist (Right Arrow)"
            className="w-14 h-14 md:w-16 md:h-16 rounded-full border-2 border-zinc-200 bg-white text-zinc-400 hover:text-emerald-600 hover:border-emerald-600 hover:bg-emerald-50/50 focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:outline-none transition-all duration-200 flex items-center justify-center cursor-pointer shadow-md text-2xl font-bold group"
          >
            <span className="transform group-hover:scale-110 transition-transform">✓</span>
          </button>

          {/* Details Button */}
          <button
            type="button"
            onMouseEnter={() => sound.play("hover")}
            onClick={() => {
              sound.play("click");
              if (activeCard) setDetailsCard(activeCard);
            }}
            title="View Details (Enter)"
            className="w-11 h-11 md:w-12 md:h-12 rounded-full border border-zinc-300 bg-white text-zinc-600 hover:text-zinc-950 hover:border-zinc-400 hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:outline-none transition-all flex items-center justify-center cursor-pointer shadow-sm text-sm font-bold font-mono"
          >
            ℹ
          </button>
        </div>
      )}

      {/* Keyboard Shortcut Hints (Desktop) */}
      <div className="hidden md:flex items-center gap-4 mt-4 font-mono text-[10px] text-zinc-400 uppercase tracking-widest">
        <span>← [PASS]</span>
        <span>•</span>
        <span>↑ [SEEN]</span>
        <span>•</span>
        <span>→ [WANT]</span>
        <span>•</span>
        <span>U [UNDO]</span>
        <span>•</span>
        <span>ENTER [INFO]</span>
      </div>

      {/* Long-Press Popup Menu */}
      <SwipePopup
        open={popupOpen}
        card={activeCard}
        onClose={() => setPopupOpen(false)}
        onMarkWatched={() => {
          setPopupOpen(false);
          if (activeCard) setRatingCard(activeCard);
        }}
        onMarkNever={handleMarkNever}
        onViewDetails={() => {
          setPopupOpen(false);
          if (activeCard) setDetailsCard(activeCard);
        }}
      />

      {/* Quick Details Modal */}
      {detailsCard && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setDetailsCard(null)}
        >
          <div
            className="w-full max-w-lg bg-white border border-zinc-200 shadow-2xl rounded-sm overflow-hidden text-zinc-950 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-zinc-100 bg-zinc-50 text-zinc-500 flex justify-between items-center select-none">
              <span className="font-mono font-bold text-[10px] tracking-widest uppercase">
                {detailsCard.mediaType === "movie" ? "FILM OVERVIEW" : "SERIES OVERVIEW"}
              </span>
              <button
                type="button"
                onClick={() => setDetailsCard(null)}
                className="text-zinc-400 hover:text-zinc-950 font-mono text-xs cursor-pointer"
              >
                [CLOSE]
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div>
                <h3 className="font-sans font-black text-2xl uppercase tracking-tight text-zinc-900 leading-tight">
                  {detailsCard.title}
                </h3>
                <p className="font-mono text-[11px] text-zinc-500 tracking-wider uppercase mt-1">
                  RELEASE: {detailsCard.releaseYear ?? "N/A"} · TYPE:{" "}
                  {detailsCard.mediaType.toUpperCase()}
                </p>
              </div>

              {detailsCard.matchPercentage != null && (
                <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#39FF14]" />
                    <span className="font-mono font-bold text-xs uppercase tracking-wider text-zinc-900">
                      MATCH SCORE: {detailsCard.matchPercentage}%
                    </span>
                  </div>
                  {detailsCard.matchFeatures && detailsCard.matchFeatures.length > 0 && (
                    <p className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider mt-1">
                      Matched taste vectors: {detailsCard.matchFeatures.join(", ")}
                    </p>
                  )}
                </div>
              )}

              <div>
                <h4 className="font-mono font-bold text-[10px] uppercase tracking-widest text-zinc-400 mb-1.5">
                  Synopsis
                </h4>
                <p className="font-sans text-xs md:text-sm text-zinc-700 leading-relaxed">
                  {detailsCard.overview || "No overview provided."}
                </p>
              </div>

              <div className="pt-3 border-t border-zinc-100 flex items-center justify-between gap-3">
                <Link
                  href={`/media/${detailsCard.mediaType}/${detailsCard.tmdbId}`}
                  onMouseEnter={() => sound.play("hover")}
                  onClick={() => sound.play("click")}
                  className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-900 hover:text-red-600 underline underline-offset-4"
                >
                  Open Full TMDB Record →
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setDetailsCard(null);
                    topCardRef.current?.swipe("right");
                  }}
                  className="px-4 py-2 bg-zinc-900 text-white font-sans font-bold text-xs uppercase tracking-widest hover:bg-zinc-800 rounded-sm cursor-pointer"
                >
                  Want to Watch
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Watchlist Rating / Review Modal */}
      {ratingCard && (
        <WatchlistModal
          open={true}
          initialStatus="Completed"
          onClose={() => setRatingCard(null)}
          media={{
            tmdbId: ratingCard.tmdbId,
            mediaType: ratingCard.mediaType,
            title: ratingCard.title,
            posterPath: ratingCard.posterPath,
            releaseYear: ratingCard.releaseYear,
          }}
          customSubmit={async (formData) => {
            const card = ratingCard;
            setRatingCard(null);

            // Advance deck & record in history
            setCurrentIndex((prev) => prev + 1);
            setHistory((prev) => [{ card, action: "watched" }, ...prev]);

            const actionText = `Marked "${card.title}" as Watched${
              formData.rating ? ` (${formData.rating}/10)` : ""
            }`;
            setAnnouncement(actionText);
            showToast(actionText);

            try {
              const res = await fetch("/api/discover/swipe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  tmdbId: card.tmdbId,
                  mediaType: card.mediaType,
                  action: "watched",
                  position: currentIndex,
                  source: card.source || "trending",
                  itemSnapshot: {
                    title: card.title,
                    posterPath: card.posterPath,
                    releaseYear: card.releaseYear,
                  },
                  status: formData.status,
                  rating: formData.rating,
                  review: formData.review,
                  tags: formData.tags,
                }),
              });

              if (res.ok) {
                window.dispatchEvent(new CustomEvent("watchlist-updated"));
              }
            } catch (err) {
              console.error("Failed to commit rated swipe:", err);
            }
          }}
          onSaved={() => {}}
        />
      )}
    </div>
  );
}
