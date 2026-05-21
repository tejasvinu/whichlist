"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Block } from "@/components/Block";
import { sound } from "@/lib/audio";

interface Universe {
  _id: string;
  name: string;
  slug: string;
  description: string;
  items: any[];
  avgRating: number | null;
  ratingCount: number;
}

export function UniversesClient() {
  const { data: session } = useSession();
  const [universes, setUniverses] = useState<Universe[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState("");

  const fetchUniverses = useCallback(async () => {
    try {
      const res = await fetch(`/api/universes?q=${encodeURIComponent(search)}`);
      if (res.ok) {
        const data = await res.json();
        setUniverses(data.universes ?? []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchUniverses();
  }, [fetchUniverses]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || generating) return;

    sound.play("click");
    setGenerating(true);
    setError("");
    setLogs(["SYSTEM: INITIALIZING GEMINI COGNITIVE CORE..."]);

    const logTemplates = [
      "GEMINI: HARVESTING CANON DATA VECTORS...",
      "GEMINI: MAPPING CINEMATIC TIMELINE STRUCTURE...",
      "TMDB: INITIATING MULTI-SEARCH RESOLUTION FOR ENTRIES...",
      "TMDB: PULLING ARTWORK AND POSTER SPECIFICATIONS...",
      "DB: CONNECTING TO SHREDDED METADATA REPOSITORY...",
      "DB: CACHING RESOLVED CINEMATIC UNIVERSE GRAPH...",
      "SYSTEM: SEQUENCE COMPLETE. LAUNCHING VIEWPORT..."
    ];

    let logIndex = 0;
    const interval = setInterval(() => {
      if (logIndex < logTemplates.length) {
        setLogs((prev) => [...prev, logTemplates[logIndex]]);
        logIndex++;
      } else {
        clearInterval(interval);
      }
    }, 700);

    try {
      const res = await fetch("/api/universes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Generation sequence interrupted.");
      }

      sound.play("success");
      setNewName("");
      await fetchUniverses();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to establish link with AI mainframes.");
    } finally {
      clearInterval(interval);
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <Block
        className="bg-white border border-zinc-200"
        header={
          <>
            <span>Module 04</span>
            <span className="text-red-600 font-semibold">Cinematic Universes</span>
          </>
        }
      >
        <h1 className="font-sans font-black text-4xl md:text-5xl uppercase tracking-tighter text-zinc-900">
          Cinematic Universes
        </h1>
        <p className="text-sm text-zinc-500 font-medium mt-2">
          Rate entire movie franchises and cinematic universes as a whole, then log and rate individual entries inside them.
        </p>
      </Block>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left column: Search and Generator */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="p-6 bg-white border border-zinc-200 rounded-sm shadow-sm flex flex-col gap-4">
            <p className="font-sans font-black text-lg uppercase tracking-tight border-b border-zinc-100 pb-2 text-zinc-900 select-none">
              Search Universes
            </p>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="FILTER BY NAME..."
                className="w-full bg-zinc-50 hover:bg-zinc-100 focus:bg-white text-zinc-900 border border-zinc-200 px-3.5 py-2 font-mono text-[10px] uppercase tracking-wider focus:outline-none focus:border-zinc-400 focus:shadow-sm rounded-sm transition-all placeholder-zinc-400"
              />
              {search && (
                <button
                  onClick={() => {
                    sound.play("click");
                    setSearch("");
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-zinc-400 hover:text-zinc-700 cursor-pointer"
                >
                  CLEAR
                </button>
              )}
            </div>
          </div>

          <div className="p-6 bg-white border border-zinc-200 rounded-sm shadow-sm flex flex-col gap-4">
            <p className="font-sans font-black text-lg uppercase tracking-tight border-b border-zinc-100 pb-2 text-zinc-900 select-none">
              AI Generator
            </p>
            {session ? (
              <form onSubmit={handleGenerate} className="space-y-4">
                <p className="text-xs text-zinc-500 font-medium">
                  Can't find a cinematic universe? Input the name (e.g. "MonsterVerse", "Harry Potter", "Fast & Furious") to compile it via AI.
                </p>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  disabled={generating}
                  placeholder="UNIVERSE NAME..."
                  required
                  className="w-full bg-zinc-50 hover:bg-zinc-100 focus:bg-white text-zinc-900 border border-zinc-200 px-3.5 py-2 font-mono text-[10px] uppercase tracking-wider focus:outline-none focus:border-zinc-400 focus:shadow-sm rounded-sm transition-all placeholder-zinc-400 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={generating || !newName.trim()}
                  className="w-full bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-100 disabled:text-zinc-400 text-white py-2 text-[10px] font-mono font-bold tracking-widest uppercase transition-all duration-200 rounded-sm cursor-pointer select-none"
                >
                  {generating ? "GENERATING..." : "GENERATE WITH AI"}
                </button>
              </form>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-zinc-500 font-medium">
                  Sign in to generate new cinematic universes using Gemini AI.
                </p>
                <Link
                  href="/auth/signin"
                  onClick={() => sound.play("click")}
                  className="block text-center bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-700 py-2 text-[10px] font-mono font-bold tracking-widest uppercase rounded-sm cursor-pointer select-none transition-all duration-200"
                >
                  SIGN IN TO BUILD
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Right column: List of Universes or Terminal Logs */}
        <div className="lg:col-span-3">
          {generating ? (
            <div className="bg-zinc-950 text-emerald-400 font-mono text-[10px] p-6 border border-zinc-800 rounded-sm shadow-inner space-y-1.5 h-80 overflow-y-auto w-full select-none">
              <div className="flex justify-between border-b border-zinc-800 pb-1.5 mb-1.5 text-zinc-500 font-bold">
                <span>GEMINI UNIVERSE CONSTRUCTOR v1.0</span>
                <span className="animate-pulse">STATUS: CONSTRUCTING CANON...</span>
              </div>
              {logs.map((log, idx) => (
                <div key={idx} className="leading-relaxed flex items-start gap-1">
                  <span className="text-zinc-600 shrink-0">[{new Date().toLocaleTimeString()}]</span>
                  <span className="break-all">{log}</span>
                </div>
              ))}
              {error && (
                <div className="text-red-500 font-bold border-t border-zinc-800 pt-2 mt-2 uppercase">
                  [CRITICAL ERROR]: {error}
                </div>
              )}
              {!error && (
                <div className="animate-pulse flex items-center gap-1 mt-0.5">
                  <span className="text-zinc-600">[{new Date().toLocaleTimeString()}]</span>
                  <span>_</span>
                </div>
              )}
            </div>
          ) : loading ? (
            <p className="font-mono text-xs uppercase tracking-wider text-center py-12 text-zinc-400 select-none">
              Syncing universe records...
            </p>
          ) : universes.length === 0 ? (
            <Block className="text-center py-16">
              <p className="font-sans font-black text-2xl uppercase tracking-tight text-zinc-900 mb-2 select-none">
                No Universes Found
              </p>
              <p className="text-sm text-zinc-500 font-medium mb-4 select-none">
                {search ? "No cached universes match your search." : "No cinematic universes have been generated yet."}
              </p>
              {!search && session && (
                <p className="text-xs text-zinc-400 font-mono select-none uppercase">
                  Use the generator on the left to compile the first universe!
                </p>
              )}
            </Block>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {universes.map((uni) => (
                <div
                  key={uni._id}
                  className="border border-zinc-200 hover:border-zinc-400 bg-white rounded-sm shadow-sm overflow-hidden flex flex-col justify-between transition-all duration-300 hover:shadow-md"
                >
                  <div className="p-6 space-y-4">
                    <div className="flex justify-between items-start gap-4">
                      <h3 className="font-sans font-black text-xl uppercase tracking-tight text-zinc-900 line-clamp-2">
                        {uni.name}
                      </h3>
                      {uni.avgRating !== null ? (
                        <div className="bg-zinc-50 text-zinc-900 border border-zinc-200 rounded-sm px-2.5 py-1 text-center shrink-0">
                          <p className="text-[10px] font-mono font-bold leading-none text-zinc-400">RATING</p>
                          <p className="text-sm font-sans font-extrabold mt-0.5 leading-none">★ {uni.avgRating}</p>
                          <p className="text-[7px] font-mono text-zinc-400 mt-0.5">({uni.ratingCount} VOTES)</p>
                        </div>
                      ) : (
                        <span className="text-[9px] font-mono bg-zinc-100 text-zinc-400 px-2 py-0.5 border border-zinc-200/50 rounded-sm uppercase tracking-wide shrink-0">
                          Unrated
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed line-clamp-3">
                      {uni.description}
                    </p>
                    <div className="flex gap-4 font-mono text-[9px] text-zinc-400 uppercase">
                      <span>{uni.items.length} Titles</span>
                      <span>•</span>
                      <span>Cached Globally</span>
                    </div>
                  </div>
                  <div className="px-6 pb-6 pt-0">
                    <Link
                      href={`/universes/${uni.slug}`}
                      onClick={() => sound.play("click")}
                      className="block text-center bg-zinc-900 hover:bg-zinc-800 text-white py-2 text-[10px] font-mono font-bold tracking-widest uppercase transition-all duration-200 rounded-sm cursor-pointer select-none"
                    >
                      ENTER VIEWPORT →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
