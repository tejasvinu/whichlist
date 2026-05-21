"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QuickStartPanel } from "@/components/QuickStartPanel";
import { Block } from "@/components/Block";
import { sound } from "@/lib/audio";

export function PopulateClient() {
  const [existingIds, setExistingIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExistingIds = async () => {
    try {
      const res = await fetch("/api/watchlist");
      if (res.ok) {
        const data = await res.json();
        const items = data.items ?? [];
        setExistingIds(items.map((item: any) => item.tmdbId));
      }
    } catch (err) {
      console.error("Failed to fetch watchlist IDs", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExistingIds();
  }, []);

  return (
    <div className="space-y-8 animate-fade-in">
      <Block
        className="bg-white border border-zinc-200"
        header={
          <>
            <span>Module 03</span>
            <span className="text-red-600 font-semibold">Populate Library</span>
          </>
        }
      >
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h1 className="font-sans font-black text-4xl md:text-5xl uppercase tracking-tighter text-zinc-900">
              AI Populate
            </h1>
            <p className="text-sm text-zinc-500 font-medium mt-2">
              Let the AI recommendation engine search and generate a curated list of recommendations to seed your watch history.
            </p>
          </div>
          <Link
            href="/library"
            onClick={() => sound.play("click")}
            className="self-start sm:self-center bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-4 py-2 border border-zinc-200 text-xs font-mono font-bold tracking-widest uppercase rounded-sm cursor-pointer select-none transition-all duration-200"
          >
            [Back to List]
          </Link>
        </div>
      </Block>

      {loading ? (
        <p className="font-mono text-xs uppercase tracking-wider text-center py-12 text-zinc-400">Initializing workspace...</p>
      ) : (
        <QuickStartPanel
          onItemAdded={fetchExistingIds}
          existingItemIds={existingIds}
        />
      )}
    </div>
  );
}
