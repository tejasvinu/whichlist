"use client";

import {
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from "react";
import Image from "next/image";
import { posterUrl } from "@/lib/tmdb";
import { sound } from "@/lib/audio";

export interface DeckCardItem {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  releaseYear: number | null;
  overview: string;
  score?: number;
  matchPercentage?: number;
  matchFeatures?: string[];
  source?: "trending" | "seed";
}

export interface SwipeCardHandle {
  swipe: (direction: "left" | "right" | "up") => void;
}

interface SwipeCardProps {
  card: DeckCardItem;
  isTop: boolean;
  stackIndex: number;
  onSwipe: (direction: "left" | "right" | "up") => void;
  onLongPress: () => void;
  onTap: () => void;
}

export const SwipeCard = forwardRef<SwipeCardHandle, SwipeCardProps>(
  function SwipeCard(
    { card, isTop, stackIndex, onSwipe, onLongPress, onTap },
    ref
  ) {
    const cardRef = useRef<HTMLDivElement | null>(null);
    const wantStampRef = useRef<HTMLDivElement | null>(null);
    const passStampRef = useRef<HTMLDivElement | null>(null);
    const seenStampRef = useRef<HTMLDivElement | null>(null);

    const originRef = useRef({ x: 0, y: 0, time: 0 });
    const ringBufferRef = useRef<{ x: number; y: number; time: number }[]>([]);
    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isDraggingRef = useRef(false);
    const longPressFiredRef = useRef(false);
    const isAnimatingRef = useRef(false);
    const movedFarRef = useRef(false);
    const wasDraggedRef = useRef(false);

    const resetStamps = useCallback(() => {
      if (wantStampRef.current) wantStampRef.current.style.opacity = "0";
      if (passStampRef.current) passStampRef.current.style.opacity = "0";
      if (seenStampRef.current) seenStampRef.current.style.opacity = "0";
    }, []);

    const snapBack = useCallback(() => {
      if (!cardRef.current) return;
      const currentTransform = cardRef.current.style.transform;
      resetStamps();
      const anim = cardRef.current.animate(
        [
          { transform: currentTransform },
          { transform: "translate3d(0, 0, 0) rotate(0deg) scale(1)" },
        ],
        {
          duration: 220,
          easing: "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
          fill: "forwards",
        }
      );
      anim.onfinish = () => {
        try {
          anim.cancel();
        } catch {
          // Fallback if already cancelled
        }
        if (cardRef.current) {
          cardRef.current.style.transform = "";
        }
      };
    }, [resetStamps]);

    const flyOff = useCallback(
      (
        targetX: number,
        targetY: number,
        targetRotate: number,
        dir: "left" | "right" | "up"
      ) => {
        if (!cardRef.current || isAnimatingRef.current) return;
        isAnimatingRef.current = true;
        sound.play("whoosh");
        sound.play(dir === "right" ? "success" : dir === "up" ? "laser" : "trash");

        const currentTransform =
          cardRef.current.style.transform || "translate3d(0, 0, 0)";

        const anim = cardRef.current.animate(
          [
            { transform: currentTransform },
            {
              transform: `translate3d(${targetX}px, ${targetY}px, 0) rotate(${targetRotate}deg)`,
              opacity: 0,
            },
          ],
          {
            duration: 260,
            easing: "cubic-bezier(0.2, 0.9, 0.3, 1)",
            fill: "forwards",
          }
        );

        anim.onfinish = () => {
          try {
            anim.cancel();
          } catch {
            // Fallback
          }
          onSwipe(dir);
        };
      },
      [onSwipe]
    );

    // Expose programmatic swipe trigger to parent
    useImperativeHandle(
      ref,
      () => ({
        swipe: (direction: "left" | "right" | "up") => {
          if (!isTop || isAnimatingRef.current) return;
          if (direction === "right") {
            if (wantStampRef.current) wantStampRef.current.style.opacity = "1";
            flyOff(window.innerWidth || 800, 40, 24, "right");
          } else if (direction === "left") {
            if (passStampRef.current) passStampRef.current.style.opacity = "1";
            flyOff(-(window.innerWidth || 800), 40, -24, "left");
          } else if (direction === "up") {
            if (seenStampRef.current) seenStampRef.current.style.opacity = "1";
            flyOff(0, -(window.innerHeight || 800), 0, "up");
          }
        },
      }),
      [flyOff, isTop]
    );

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isTop || isAnimatingRef.current || !e.isPrimary) return;

      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Pointer capture fallback
      }

      originRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
      ringBufferRef.current = [{ x: e.clientX, y: e.clientY, time: Date.now() }];
      isDraggingRef.current = true;
      longPressFiredRef.current = false;
      movedFarRef.current = false;
      wasDraggedRef.current = false;

      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }

      longPressTimerRef.current = setTimeout(() => {
        if (!movedFarRef.current && isDraggingRef.current) {
          longPressFiredRef.current = true;
          sound.play("click");
          snapBack();
          onLongPress();
        }
      }, 500);
    };

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current || longPressFiredRef.current || !cardRef.current) {
        return;
      }

      const dx = e.clientX - originRef.current.x;
      const dy = e.clientY - originRef.current.y;

      if (Math.hypot(dx, dy) > 10) {
        movedFarRef.current = true;
        wasDraggedRef.current = true;
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      }

      ringBufferRef.current.push({ x: e.clientX, y: e.clientY, time: Date.now() });
      if (ringBufferRef.current.length > 5) {
        ringBufferRef.current.shift();
      }

      // 60fps direct style mutation without triggering React render
      const rotateDeg = dx / 20;
      cardRef.current.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${rotateDeg}deg)`;

      // Dynamic stamp badge opacities
      if (dy < -30 && Math.abs(dy) > Math.abs(dx) * 1.1) {
        // Dominant Up motion -> SEEN
        const seenOpacity = Math.min(1, (-dy - 30) / 90);
        if (seenStampRef.current) seenStampRef.current.style.opacity = String(seenOpacity);
        if (wantStampRef.current) wantStampRef.current.style.opacity = "0";
        if (passStampRef.current) passStampRef.current.style.opacity = "0";
      } else if (dx > 20) {
        // Right motion -> WANT
        const wantOpacity = Math.min(1, (dx - 20) / 90);
        if (wantStampRef.current) wantStampRef.current.style.opacity = String(wantOpacity);
        if (passStampRef.current) passStampRef.current.style.opacity = "0";
        if (seenStampRef.current) seenStampRef.current.style.opacity = "0";
      } else if (dx < -20) {
        // Left motion -> PASS
        const passOpacity = Math.min(1, (-dx - 20) / 90);
        if (passStampRef.current) passStampRef.current.style.opacity = String(passOpacity);
        if (wantStampRef.current) wantStampRef.current.style.opacity = "0";
        if (seenStampRef.current) seenStampRef.current.style.opacity = "0";
      } else {
        resetStamps();
      }
    };

    const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;

      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture fallback
      }

      if (longPressFiredRef.current) {
        snapBack();
        return;
      }

      const dx = e.clientX - originRef.current.x;
      const dy = e.clientY - originRef.current.y;
      const dt = Math.max(1, Date.now() - originRef.current.time);

      // Tap detection: minimal displacement & brief duration
      if (Math.hypot(dx, dy) < 10 && dt < 450) {
        snapBack();
        onTap();
        return;
      }

      // Velocity calculation from ring buffer
      const firstSample = ringBufferRef.current[0] || originRef.current;
      const lastSample =
        ringBufferRef.current[ringBufferRef.current.length - 1] || {
          x: e.clientX,
          y: e.clientY,
          time: Date.now(),
        };
      const deltaT = Math.max(1, lastSample.time - firstSample.time);
      const vx = (lastSample.x - firstSample.x) / deltaT;
      const vy = (lastSample.y - firstSample.y) / deltaT;

      // Commit conditions:
      // Dominant Up
      if (Math.abs(dy) > Math.abs(dx) && (dy < -110 || vy < -0.55)) {
        flyOff(0, -(window.innerHeight || 800), 0, "up");
        return;
      }

      // Right (Want)
      if (dx > 110 || vx > 0.5) {
        flyOff(window.innerWidth || 800, dy * 1.5, 25, "right");
        return;
      }

      // Left (Pass)
      if (dx < -110 || vx < -0.5) {
        flyOff(-(window.innerWidth || 800), dy * 1.5, -25, "left");
        return;
      }

      // Snap back if threshold not reached
      snapBack();
    };

    // Stack scaling for cards behind the top card
    const scale = 1 - stackIndex * 0.04;
    const translateY = stackIndex * 14;
    const zIndex = 30 - stackIndex * 10;
    const opacity = stackIndex === 0 ? 1 : stackIndex === 1 ? 0.9 : 0.7;

    const poster = posterUrl(card.posterPath, "w500");

    return (
      <div
        ref={cardRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onClick={(e) => {
          if (wasDraggedRef.current) {
            e.preventDefault();
            e.stopPropagation();
            wasDraggedRef.current = false;
          }
        }}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          transform: isTop ? undefined : `translate3d(0, ${translateY}px, 0) scale(${scale})`,
          zIndex,
          opacity,
          transition: isTop ? undefined : "transform 0.3s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.3s ease",
        }}
        className={`absolute inset-0 w-full h-full rounded-md border-2 border-zinc-900 bg-zinc-950 text-white shadow-2xl overflow-hidden select-none touch-none swipe-card-touch ${
          isTop ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"
        }`}
      >
        {/* Poster Image */}
        {poster ? (
          <Image
            src={poster}
            alt={card.title}
            fill
            sizes="(max-width: 768px) 90vw, 420px"
            priority={stackIndex <= 1}
            draggable={false}
            className="object-cover pointer-events-none no-drag"
          />
        ) : (
          <div className="w-full h-full bg-zinc-900 flex flex-col items-center justify-center p-6 text-center select-none">
            <span className="font-mono text-zinc-600 text-xs tracking-widest uppercase mb-2">
              NO POSTER AVAILABLE
            </span>
            <span className="font-sans font-black text-2xl uppercase tracking-tighter text-zinc-400">
              {card.title}
            </span>
          </div>
        )}

        {/* Ambient Dark Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent pointer-events-none" />

        {/* High-Contrast Match Badge (Top Left) */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-1 items-start pointer-events-none">
          {card.matchPercentage != null && (
            <div className="flex items-center gap-1.5 bg-black/85 backdrop-blur-md px-2.5 py-1 rounded-sm border border-zinc-700/80 shadow-md">
              <span className="w-2 h-2 rounded-full bg-[#39FF14] animate-pulse" />
              <span className="font-mono text-[10px] font-bold text-white tracking-widest uppercase">
                MATCH {card.matchPercentage}%
              </span>
            </div>
          )}
          {card.matchFeatures && card.matchFeatures.length > 0 && (
            <div className="bg-zinc-900/90 backdrop-blur-md px-2 py-0.5 rounded-sm border border-zinc-800 text-zinc-300 font-mono text-[9px] uppercase tracking-wider max-w-[260px] truncate">
              {card.matchFeatures.join(" · ")}
            </div>
          )}
        </div>

        {/* Media Type & Source Tag (Top Right) */}
        <div className="absolute top-4 right-4 z-10 pointer-events-none">
          <span className="bg-zinc-950/90 backdrop-blur-md px-2.5 py-1 text-[10px] font-mono font-bold tracking-widest uppercase border border-zinc-700 text-zinc-200 rounded-sm">
            {card.mediaType === "movie" ? "FILM" : "TV"}
          </span>
        </div>

        {/* Stamp Badges (Driven by pointermove opacity) */}
        {/* WANT (Like - Green) */}
        <div
          ref={wantStampRef}
          style={{ opacity: 0 }}
          className="absolute top-16 left-6 z-20 pointer-events-none border-4 border-emerald-500 bg-zinc-950/95 text-emerald-400 font-mono font-black text-3xl md:text-4xl px-4 py-1.5 uppercase tracking-widest rotate-[-12deg] shadow-2xl transition-opacity duration-75"
        >
          WANT
        </div>

        {/* PASS (Left - Red) */}
        <div
          ref={passStampRef}
          style={{ opacity: 0 }}
          className="absolute top-16 right-6 z-20 pointer-events-none border-4 border-red-600 bg-zinc-950/95 text-red-500 font-mono font-black text-3xl md:text-4xl px-4 py-1.5 uppercase tracking-widest rotate-[12deg] shadow-2xl transition-opacity duration-75"
        >
          PASS
        </div>

        {/* SEEN (Up - Cobalt/Blue) */}
        <div
          ref={seenStampRef}
          style={{ opacity: 0 }}
          className="absolute top-28 inset-x-0 mx-auto w-fit z-20 pointer-events-none border-4 border-blue-500 bg-zinc-950/95 text-blue-400 font-mono font-black text-3xl md:text-4xl px-5 py-1.5 uppercase tracking-widest rotate-[-3deg] shadow-2xl transition-opacity duration-75"
        >
          SEEN
        </div>

        {/* Bottom Card Information */}
        <div className="absolute bottom-0 inset-x-0 p-5 md:p-6 z-10 pointer-events-none">
          <div className="flex items-center gap-2 mb-1.5 text-zinc-400 font-mono text-[11px] tracking-wider uppercase">
            <span>{card.releaseYear ?? "N/A"}</span>
            <span>{"//"}</span>
            <span>{card.mediaType === "movie" ? "FEATURE" : "SERIES"}</span>
          </div>

          <h2 className="font-sans font-black text-2xl md:text-3xl uppercase tracking-tight text-white leading-tight mb-2 drop-shadow-sm line-clamp-2">
            {card.title}
          </h2>

          <p className="text-zinc-300 text-xs leading-relaxed font-sans line-clamp-2 drop-shadow-sm">
            {card.overview || "No synopsis available."}
          </p>

          <div className="mt-3.5 flex items-center justify-between text-[10px] font-mono text-zinc-400 border-t border-zinc-800/80 pt-2.5">
            <span className="tracking-widest uppercase text-zinc-400">
              TAP FOR DETAILS
            </span>
            <span className="tracking-widest uppercase text-zinc-500">
              HOLD: MENU
            </span>
          </div>
        </div>
      </div>
    );
  }
);
