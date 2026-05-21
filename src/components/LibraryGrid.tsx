"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { WATCH_STATUSES, SORT_OPTIONS, MEDIA_TYPES } from "@/lib/constants";
import { WatchlistModal } from "./WatchlistModal";
import { Block } from "./Block";
import { CustomSelect } from "./CustomSelect";
import { sound } from "@/lib/audio";
import type { WatchStatus } from "@/lib/constants";

interface WatchlistItemData {
  _id: string;
  tmdbId: number;
  mediaType: "movie" | "tv" | "universe";
  slug?: string;
  title: string;
  posterPath: string | null;
  releaseYear: number | null;
  status: WatchStatus;
  rating?: number;
  review?: string;
  tags?: string[];
  dateAdded: string;
}

function getRoast(itemsList: WatchlistItemData[]) {
  const droppedCount = itemsList.filter((item) => item.status === "Dropped").length;
  const planCount = itemsList.filter((item) => item.status === "Plan to Watch").length;

  const ratedItems = itemsList.filter((item) => item.rating !== undefined && item.rating !== null);
  const avgRating = ratedItems.length
    ? parseFloat((ratedItems.reduce((acc, curr) => acc + (curr.rating || 0), 0) / ratedItems.length).toFixed(2))
    : 0;

  const EMPTY_ROASTS = [
    "LIST UNDER-UTILIZED. INITIATE TELEMETRY LOGGING IMMEDIATELY.",
    "DATA SPARSE. ARE YOU EVEN WATCHING ANYTHING, OR JUST STARING AT THIS TERMINAL?",
    "EMPTY LIST DETECTED. YOUR CINEMATIC EXPERIENCE IS A BLANK CANVAS. RECTIFY."
  ];

  const HIGH_ROASTS = [
    "CRITICAL METRIC: SUSPICIOUSLY HIGH TASTE INTEGRITY. ARE YOU EXCLUSIVELY WATCHING CITIZEN KANE?",
    "DIAGNOSTIC DETECTS TOXIC POSITIVITY. 10/10 IS A SACRED RATING, NOT A PARTICIPATION TROPHY.",
    "STATUS: CINEMATIC GLUTTON. EVERYTHING IS AMAZING, OR YOU HAVE ZERO CRITICAL CAPACITY.",
    "ALERT: FILM CRITIC DELUSION ACTIVE. TASTE RADAR PINNED TO MAXIMUM SENSITIVITY."
  ];

  const MID_ROASTS = [
    "STATUS NORMAL: OPTIMIZED TASTE PARADIGM. COGNITIVE APPRECIATION LEVELS WITHIN DESIGNATED TOLERANCES.",
    "TASTE ANALYSIS: STAGGERINGLY AVERAGE. YOUR FAVORITE MOVIE IS PROBABLY THE SHAWSHANK REDEMPTION.",
    "SYSTEM CONCLUDES: REASONABLE DISCERNMENT DETECTED. NO SYSTEM HEURISTICS TRIGGERED.",
    "LOG ENTRY: BALANCED RATIO OF MASTERPIECES TO GARBAGE. COMPILING..."
  ];

  const LOW_ROASTS = [
    "DIAGNOSTIC ALERT: CINEMATIC MISANTHROPE. YOU HATE CINEMA. SYSTEM DETECTS SEVERE LACK OF JOY.",
    "CRITICAL ERROR: TASTE INTEGRITY CRIPPLED. WHY DO YOU KEEP WATCHING THINGS YOU ABHOR?",
    "ALERT: ABSOLUTE CRITIC FROM HELL. EVEN KUBRICK WOULD GET A 4/10 FROM YOU.",
    "DIAGNOSTIC: CRITICAL NEGATIVITY OVERLOAD. ENGAGE DOPAMINE RECEPTORS IMMEDIATELY."
  ];

  const DROPPED_ROASTS = [
    "TASTE TURBULENCE: CRITICAL STORAGE DRIFT. STOP DROPPING LOGS AND INITIATE COMMITMENT MODULES.",
    "DIAGNOSTIC: SEVERE COMMITMENT PHOBIA. QUANTUM DECAY RATE OF YOUR INTERMEDIATE LOGS IS UNACCEPTABLE."
  ];

  const BACKLOG_ROASTS = [
    "WARNING: HOARDING DISORDER DETECTED. YOUR BACKLOG IS EXPANDING FASTER THAN THE UNIVERSE.",
    "STATUS: PROFESSIONAL HOARDER. LIST IS A GRAVEYARD OF INTENTIONS."
  ];

  const randomFrom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

  if (itemsList.length === 0) {
    return randomFrom(EMPTY_ROASTS);
  }
  if (droppedCount > 4) {
    return randomFrom(DROPPED_ROASTS);
  }
  if (planCount > 10) {
    return randomFrom(BACKLOG_ROASTS);
  }
  if (avgRating > 8.0 && ratedItems.length > 0) {
    return randomFrom(HIGH_ROASTS);
  }
  if (avgRating < 5.0 && ratedItems.length > 0) {
    return randomFrom(LOW_ROASTS);
  }
  return randomFrom(MID_ROASTS);
}

export function LibraryGrid() {
  const [items, setItems] = useState<WatchlistItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [mediaType, setMediaType] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("dateAdded");
  const [editItem, setEditItem] = useState<WatchlistItemData | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [roastMessage, setRoastMessage] = useState("LIST UNDER-UTILIZED. TRACK MORE TELEMETRY LOGS.");
  const [tasteProfile, setTasteProfile] = useState<{
    headline: string;
    roast: string;
    archetype: string;
    topPatterns: string[];
    blindSpot: string;
  } | null>(null);
  const [generatingProfile, setGeneratingProfile] = useState(false);
  const [selectedTag, setSelectedTag] = useState("");
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [notInterestedIds, setNotInterestedIds] = useState<Set<string>>(new Set());
  const [showNotInterested, setShowNotInterested] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    if (!generatingProfile) {
      setTerminalLogs([]);
      return;
    }

    const logTemplates = [
      "SYSTEM: INITIATING VAULT TELEMETRY ANALYSIS...",
      "DB: ESTABLISHING CONNECTIVITY TO WATCHLIST COLLECTION...",
      "DB: PARSING METRIC SCHEMA VALUES...",
      "GEMINI: CONNECTING TO COGNITIVE CRITIC ENGINE...",
      "GEMINI: MODEL RESPONSE QUEUED (GEMINI-2.0-FLASH)...",
      "GEMINI: EXTRACTING SYSTEM ARCHETYPE & RATING PREFERENCES...",
      "SYSTEM: GENERATING CRITIC ROAST DIAGNOSTIC...",
      "SYSTEM: CURATING PERSONALIZED REC VECTOR ARRAYS...",
      "SYSTEM: TELEMETRY COMPILE COMPLETE. PRINTING RESULTS."
    ];

    let currentIdx = 0;
    setTerminalLogs([logTemplates[0]]);
    currentIdx++;

    const interval = setInterval(() => {
      if (currentIdx < logTemplates.length) {
        setTerminalLogs((prev) => [...prev, logTemplates[currentIdx]]);
        currentIdx++;
      } else {
        clearInterval(interval);
      }
    }, 600);

    return () => clearInterval(interval);
  }, [generatingProfile]);

  const uniqueTags = useMemo(() => {
    const tagsSet = new Set<string>();
    items.forEach((item) => {
      if (item.tags) {
        item.tags.forEach((t) => {
          if (t !== "not-interested") tagsSet.add(t);
        });
      }
    });
    return Array.from(tagsSet).sort();
  }, [items]);

  const displayedItems = useMemo(() => {
    if (!selectedTag) return items;
    return items.filter((item) => item.tags && item.tags.includes(selectedTag));
  }, [items, selectedTag]);

  const visibleItems = useMemo(
    () => displayedItems.filter((item) => !notInterestedIds.has(item._id)),
    [displayedItems, notInterestedIds]
  );

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (mediaType) params.set("mediaType", mediaType);
    if (status) params.set("status", status);
    params.set("sort", sort);
    if (showNotInterested) params.set("showNotInterested", "true");

    const res = await fetch(`/api/watchlist?${params}`);
    const data = await res.json();
    const itemsList = data.items ?? [];
    setItems(itemsList);
    setRoastMessage(getRoast(itemsList));
    setLoading(false);
  }, [mediaType, status, sort, showNotInterested]);

  const fetchTasteProfile = useCallback(async (force = false) => {
    setGeneratingProfile(true);
    try {
      const res = await fetch("/api/ai/taste-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate: force }),
      });
      if (res.ok) {
        const data = await res.json();
        setTasteProfile(data);
        if (data.roast) {
          setRoastMessage(data.roast);
        }
      }
    } catch (err) {
      console.error("Failed to fetch taste profile:", err);
    } finally {
      setGeneratingProfile(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    fetchTasteProfile(false);
  }, [fetchTasteProfile]);

  const handleSaved = useCallback(() => {
    fetchItems();
    fetchTasteProfile(false);
  }, [fetchItems, fetchTasteProfile]);

  function openEdit(item: WatchlistItemData) {
    setEditItem(item);
    setModalOpen(true);
  }

  async function handleQuickNotInterested(item: WatchlistItemData) {
    sound.play("click");
    // Optimistically hide the card
    setNotInterestedIds((prev) => new Set([...prev, item._id]));
    try {
      await fetch(`/api/watchlist/${item._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: [...(item.tags ?? []).filter((t) => t !== "not-interested"), "not-interested"] }),
      });
      sound.play("success");
      fetchItems();
    } catch (err) {
      console.error(err);
      // Revert on error
      setNotInterestedIds((prev) => {
        const next = new Set(prev);
        next.delete(item._id);
        return next;
      });
    }
  }

  function handleQuickMarkWatched(item: WatchlistItemData) {
    sound.play("click");
    // Open edit modal with the item pre-loaded so user can fill in rating/review
    setEditItem({ ...item, status: "Completed" });
    setModalOpen(true);
  }

  async function handleDeleteItem(item: WatchlistItemData) {
    if (!confirm(`Remove "${item.title}" from your list?`)) return;

    sound.play("click");
    setItems((prev) => prev.filter((i) => i._id !== item._id));

    try {
      const url = item.mediaType === "universe"
        ? `/api/universes/${item.slug}/rate`
        : `/api/watchlist/${item._id}`;
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      sound.play("trash");
      fetchItems();
      fetchTasteProfile(false);
    } catch (err) {
      console.error(err);
      fetchItems();
    }
  }

  const escapeCSVValue = (val: unknown): string => {
    if (val === null || val === undefined) return "";
    let str = "";
    if (Array.isArray(val)) {
      str = val.join(", ");
    } else if (val instanceof Date) {
      str = val.toISOString();
    } else {
      str = String(val);
    }
    if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const handleExportCSV = async () => {
    sound.play("click");
    try {
      const res = await fetch("/api/watchlist?export=true");
      if (!res.ok) throw new Error("Failed to fetch watchlist for export");
      const data = await res.json();
      const allItems = data.items ?? [];

      if (allItems.length === 0) {
        alert("Your watchlist is empty. Nothing to export!");
        return;
      }

      const headers = [
        "ID",
        "User ID",
        "TMDB ID",
        "Media Type",
        "Title",
        "Poster Path",
        "Release Year",
        "Status",
        "Rating",
        "Review",
        "Tags",
        "Date Added",
        "Created At",
        "Updated At"
      ];

      const csvRows = [headers.join(",")];

      for (const item of allItems) {
        const row = [
          escapeCSVValue(item._id),
          escapeCSVValue(item.userId),
          escapeCSVValue(item.tmdbId),
          escapeCSVValue(item.mediaType),
          escapeCSVValue(item.title),
          escapeCSVValue(item.posterPath),
          escapeCSVValue(item.releaseYear),
          escapeCSVValue(item.status),
          escapeCSVValue(item.rating),
          escapeCSVValue(item.review),
          escapeCSVValue(item.tags),
          escapeCSVValue(item.dateAdded),
          escapeCSVValue(item.createdAt),
          escapeCSVValue(item.updatedAt)
        ];
        csvRows.push(row.join(","));
      }

      const csvContent = csvRows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `watchlist_export_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      sound.play("success");
    } catch (err) {
      console.error(err);
      alert("Failed to export CSV. Please try again.");
    }
  };

  const handleExportJSON = async () => {
    sound.play("click");
    try {
      const res = await fetch("/api/watchlist?export=true");
      if (!res.ok) throw new Error("Failed to fetch watchlist for export");
      const data = await res.json();
      const allItems = data.items ?? [];

      if (allItems.length === 0) {
        alert("Your watchlist is empty. Nothing to export!");
        return;
      }

      const jsonContent = JSON.stringify(allItems, null, 2);
      const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `watchlist_export_${new Date().toISOString().split("T")[0]}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      sound.play("success");
    } catch (err) {
      console.error(err);
      alert("Failed to export JSON. Please try again.");
    }
  };

  // Calculate list telemetry stats
  const completedCount = items.filter((item) => item.status === "Completed").length;
  const droppedCount = items.filter((item) => item.status === "Dropped").length;
  const planCount = items.filter((item) => item.status === "Plan to Watch").length;

  const integrityScore = Math.max(
    0,
    Math.min(
      100,
      items.length === 0
        ? 100
        : Math.round(100 - droppedCount * 12 - planCount * 3)
    )
  );

  const ratedItems = items.filter((item) => item.rating !== undefined && item.rating !== null);
  const avgRating = ratedItems.length
    ? parseFloat((ratedItems.reduce((acc, curr) => acc + (curr.rating || 0), 0) / ratedItems.length).toFixed(2))
    : 0;

  // Status-specific pill color matching for a highly curated editorial feel
  const getStatusBadgeStyle = (s: WatchStatus) => {
    switch (s) {
      case "Completed":
        return "bg-zinc-100 text-zinc-800 border-zinc-200";
      case "Watching":
        return "bg-red-50 text-red-600 border-red-100";
      case "Plan to Watch":
        return "bg-zinc-50 text-zinc-500 border-zinc-200/50";
      case "Dropped":
        return "bg-zinc-100 text-zinc-400 border-zinc-200/40 line-through";
      default:
        return "bg-zinc-100 text-zinc-600 border-zinc-200";
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        {/* FILTERS PANEL */}
        <div className="lg:col-span-1 flex flex-col gap-5 p-6 bg-white border border-zinc-200 rounded-sm shadow-sm">
          <p className="font-sans font-black text-lg uppercase tracking-tight border-b border-zinc-100 pb-2 mb-1 text-zinc-900">
            Filters
          </p>
          <CustomSelect
            label="Type"
            value={mediaType}
            options={[
              { value: "", label: "ALL MEDIA" },
              ...MEDIA_TYPES.map((t) => ({ value: t, label: t.toUpperCase() })),
              { value: "universe", label: "UNIVERSES" },
            ]}
            onChange={setMediaType}
          />
          <CustomSelect
            label="Status"
            value={status}
            options={[
              { value: "", label: "ALL STATUS" },
              ...WATCH_STATUSES.map((s) => ({ value: s, label: s.toUpperCase() })),
            ]}
            onChange={setStatus}
          />
          <CustomSelect
            label="Tag"
            value={selectedTag}
            options={[
              { value: "", label: "ALL TAGS" },
              ...uniqueTags.map((tag) => ({ value: tag, label: tag.toUpperCase() })),
            ]}
            onChange={setSelectedTag}
          />
          <CustomSelect
            label="Sort"
            value={sort}
            options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label.toUpperCase() }))}
            onChange={setSort}
          />
          <div>
            <p className="text-[9px] font-mono font-bold tracking-widest text-zinc-400 uppercase mb-1.5">
              View
            </p>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => {
                  sound.play("click");
                  setViewMode("grid");
                }}
                className={`flex-1 py-1.5 text-[9px] font-mono font-bold tracking-widest uppercase rounded-sm border cursor-pointer transition-all duration-200 select-none ${
                  viewMode === "grid"
                    ? "bg-zinc-900 border-zinc-900 text-white"
                    : "bg-zinc-50 border-zinc-200 text-zinc-500 hover:bg-zinc-100"
                }`}
              >
                Grid
              </button>
              <button
                type="button"
                onClick={() => {
                  sound.play("click");
                  setViewMode("list");
                }}
                className={`flex-1 py-1.5 text-[9px] font-mono font-bold tracking-widest uppercase rounded-sm border cursor-pointer transition-all duration-200 select-none ${
                  viewMode === "list"
                    ? "bg-zinc-900 border-zinc-900 text-white"
                    : "bg-zinc-50 border-zinc-200 text-zinc-500 hover:bg-zinc-100"
                }`}
              >
                List
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              sound.play("click");
              setShowNotInterested((prev) => !prev);
            }}
            className={`w-full py-1.5 text-[9px] font-mono font-bold tracking-widest uppercase rounded-sm border cursor-pointer transition-all duration-200 select-none ${
              showNotInterested
                ? "bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
                : "bg-zinc-50 border-zinc-200 text-zinc-500 hover:bg-zinc-100"
            }`}
          >
            {showNotInterested ? "✕ HIDE NOT INTERESTED" : "SHOW NOT INTERESTED"}
          </button>

          <div className="border-t border-zinc-100 pt-4 mt-2">
            <p className="text-[9px] font-mono font-bold tracking-widest text-zinc-400 uppercase mb-2 select-none">
              Export Vault
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onMouseEnter={() => sound.play("hover")}
                onClick={handleExportCSV}
                className="flex-1 py-1.5 text-[9px] font-mono font-bold tracking-widest uppercase rounded-sm border border-zinc-200 bg-zinc-50 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 cursor-pointer transition-all duration-200 select-none"
              >
                CSV
              </button>
              <button
                type="button"
                onMouseEnter={() => sound.play("hover")}
                onClick={handleExportJSON}
                className="flex-1 py-1.5 text-[9px] font-mono font-bold tracking-widest uppercase rounded-sm border border-zinc-200 bg-zinc-50 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 cursor-pointer transition-all duration-200 select-none"
              >
                JSON
              </button>
            </div>
          </div>
        </div>

        {/* LIST STATUS REPORT */}
        <div className="lg:col-span-3 p-6 bg-white border border-zinc-200 shadow-sm flex flex-col justify-between relative overflow-hidden rounded-sm">
          <div>
            <p className="font-sans font-black text-lg uppercase tracking-tight border-b border-zinc-100 pb-2 mb-4 flex justify-between select-none items-center">
              <span className="flex flex-col">
                <span>List Telemetry</span>
                {tasteProfile && (
                  <span className="text-[9px] text-zinc-400 font-mono tracking-wider font-normal mt-0.5 uppercase">
                    SYSTEM PROFILE: {tasteProfile.headline}
                  </span>
                )}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {generatingProfile && (
                  <span className="text-[9px] font-mono text-zinc-400 animate-pulse">ANALYZING TASTE...</span>
                )}
                {items.length > 0 && (
                  <Link
                    href="/library/populate"
                    onClick={() => sound.play("click")}
                    className="bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-600 px-2 py-0.5 text-[9px] font-mono tracking-wider uppercase rounded-sm border cursor-pointer transition-colors"
                  >
                    POPULATE WITH AI
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => fetchTasteProfile(true)}
                  disabled={generatingProfile}
                  className="bg-zinc-100 hover:bg-zinc-200 text-zinc-600 px-2 py-0.5 text-[9px] font-mono tracking-wider uppercase rounded-sm border border-zinc-200 cursor-pointer disabled:opacity-50"
                >
                  RE-ANALYZE
                </button>
                <span className="bg-red-50 text-red-600 px-2 py-0.5 text-[9px] font-mono font-semibold tracking-widest rounded-sm border border-red-100">
                  ACTIVE
                </span>
              </div>
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-1">
              <div className="border border-zinc-100 p-3 bg-zinc-50/20 rounded-sm relative select-none">
                <p className="text-[9px] font-mono font-bold tracking-widest text-zinc-400 uppercase">TOTAL LOGS</p>
                <p className="text-2xl font-sans font-black tracking-tight text-zinc-900 mt-1">{items.length} UNITS</p>
              </div>
              <div className="border border-zinc-100 p-3 bg-zinc-50/20 rounded-sm relative select-none">
                <p className="text-[9px] font-mono font-bold tracking-widest text-zinc-400 uppercase">TASTE INTEGRITY</p>
                <p className={`text-2xl font-sans font-black tracking-tight mt-1 ${
                  integrityScore >= 70 ? "text-[#00C853]" : "text-red-600"
                }`}>
                  {integrityScore}%
                </p>
              </div>
              <div className="border border-zinc-100 p-3 bg-zinc-50/20 rounded-sm relative select-none">
                <p className="text-[9px] font-mono font-bold tracking-widest text-zinc-400 uppercase">AVG RATING</p>
                <p className="text-2xl font-sans font-black tracking-tight text-zinc-900 mt-1">
                  {avgRating ? `${avgRating} / 10` : "—"}
                </p>
              </div>
              <div className="border border-zinc-100 p-3 bg-zinc-50/20 rounded-sm relative select-none">
                <p className="text-[9px] font-mono font-bold tracking-widest text-zinc-400 uppercase">COMPLETED</p>
                <p className="text-2xl font-sans font-black tracking-tight text-zinc-900 mt-1">{completedCount} ITEMS</p>
              </div>
            </div>
          </div>
          {generatingProfile ? (
            <div className="mt-4 bg-zinc-950 text-emerald-400 font-mono text-[9px] p-4 border border-zinc-800 rounded-sm shadow-inner space-y-1 h-36 overflow-y-auto w-full select-none">
              <div className="flex justify-between border-b border-zinc-800 pb-1.5 mb-1.5 text-zinc-500 font-bold">
                <span>CRITIC DIAGNOSTIC LOGGER v1.0</span>
                <span>STATUS: RUNNING</span>
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
          ) : (
            <div>
              <div className="border-t border-dashed border-zinc-200 pt-3.5 mt-5 font-sans text-xs flex flex-wrap gap-2 items-center">
                <span className="text-red-600 font-extrabold tracking-wider select-none text-[10px] uppercase">[DIAGNOSTIC ROAST]:</span>{" "}
                <span className="uppercase text-zinc-600 text-[10px] tracking-wide font-medium">{roastMessage}</span>
              </div>
              {tasteProfile && tasteProfile.topPatterns && (
                <div className="mt-4 pt-4 border-t border-dashed border-zinc-200 grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px] font-mono select-none">
                  <div>
                    <p className="text-zinc-400 font-bold uppercase tracking-wider mb-1.5">TASTE ARCHETYPE // {tasteProfile.archetype.toUpperCase()}</p>
                    <ul className="list-inside list-disc text-zinc-500 space-y-1">
                      {tasteProfile.topPatterns.map((pat, idx) => (
                        <li key={idx} className="uppercase">{pat}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-zinc-400 font-bold uppercase tracking-wider mb-1.5">DETECTOR BLIND SPOT</p>
                    <p className="text-zinc-500 uppercase leading-relaxed">{tasteProfile.blindSpot}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <p className="font-mono text-xs uppercase tracking-wider text-center py-12 text-zinc-400">Loading list...</p>
      ) : items.length === 0 ? (
        <Block className="text-center py-16">
          <p className="font-sans font-black text-2xl uppercase tracking-tight text-zinc-900 mb-2">
            List Empty
          </p>
          <p className="text-sm text-zinc-500 font-medium mb-4">Search media items and add them to populate your curated catalog.</p>
          <Link
            href="/library/populate"
            onClick={() => sound.play("click")}
            className="inline-block bg-zinc-900 hover:bg-zinc-800 text-white px-5 py-2.5 text-[10px] font-mono font-bold tracking-widest uppercase rounded-sm border border-zinc-900 cursor-pointer shadow-md select-none transition-all duration-200 font-semibold"
          >
            Curate a Starter Pack with AI
          </Link>
        </Block>
      ) : viewMode === "list" ? (
        <div className="border border-zinc-200 rounded-sm overflow-hidden bg-white shadow-sm">
          <div className="hidden sm:grid sm:grid-cols-[48px_1fr_auto] gap-4 px-4 py-2 bg-zinc-50 border-b border-zinc-200 text-[9px] font-mono font-bold tracking-widest text-zinc-400 uppercase select-none">
            <span />
            <span>Title</span>
            <span className="text-right pr-1">Actions</span>
          </div>
          <ul className="divide-y divide-zinc-100">
            {visibleItems.map((item) => {
              const isDismissed = item.tags?.includes("not-interested");
              return (
                <li
                  key={item._id}
                  className={`flex flex-col sm:grid sm:grid-cols-[48px_1fr_auto] sm:items-center gap-3 sm:gap-4 px-4 py-3 transition-colors hover:bg-zinc-50/80 ${
                    isDismissed ? "opacity-60 bg-zinc-50/40" : ""
                  }`}
                >
                  <Link
                    href={item.mediaType === "universe" ? `/universes/${item.slug}` : `/media/${item.mediaType}/${item.tmdbId}`}
                    onClick={() => sound.play("click")}
                    className="flex items-center gap-3 sm:contents min-w-0"
                  >
                    <div className="relative w-10 h-[60px] shrink-0 bg-zinc-100 border border-zinc-200 rounded-sm overflow-hidden">
                      {item.posterPath ? (
                        <Image
                          src={item.posterPath}
                          alt={item.title}
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-[8px] font-mono text-zinc-400 uppercase">
                          n/a
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-sans font-bold text-sm uppercase tracking-wide text-zinc-900 truncate">
                        {item.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5 select-none">
                        <span className={`text-[9px] font-mono font-semibold px-2 py-0.5 border uppercase rounded-sm ${getStatusBadgeStyle(item.status)}`}>
                          {item.status}
                        </span>
                        <span
                          className={`text-[9px] font-mono font-semibold px-2 py-0.5 border uppercase rounded-sm ${
                            item.mediaType === "tv"
                              ? "bg-[#00E5FF] text-zinc-950 border-[#00E5FF]/30"
                              : item.mediaType === "universe"
                              ? "bg-red-600 text-white border-red-600/30"
                              : "bg-[#FF5722] text-white border-[#FF5722]/30"
                          }`}
                        >
                          {item.mediaType}
                        </span>
                        <span className="text-[9px] font-mono text-zinc-400 uppercase">
                          {item.releaseYear ?? "—"}
                        </span>
                        <span className="text-[9px] font-mono text-zinc-500 uppercase">
                          ★ {item.rating ? `${item.rating}/10` : "Unrated"}
                        </span>
                        {isDismissed && (
                          <span className="text-[9px] font-mono font-semibold px-2 py-0.5 border uppercase rounded-sm bg-red-50 text-red-600 border-red-100">
                            Not Interested
                          </span>
                        )}
                      </div>
                      {item.tags && item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5 select-none">
                          {item.tags
                            .filter((t) => t !== "not-interested")
                            .slice(0, 4)
                            .map((t) => (
                              <span
                                key={t}
                                className="text-[8px] font-mono text-zinc-500 bg-zinc-100/60 px-1 py-0.5 border border-zinc-200/50 rounded-sm uppercase tracking-wide"
                              >
                                {t}
                              </span>
                            ))}
                        </div>
                      )}
                    </div>
                  </Link>
                  <div className="flex items-center gap-1.5 sm:justify-end shrink-0 pl-[52px] sm:pl-0">
                    {item.mediaType !== "universe" && (
                      <>
                        <button
                          type="button"
                          title="Not Interested"
                          onClick={() => handleQuickNotInterested(item)}
                          className="bg-zinc-100 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-zinc-600 px-2.5 py-1.5 text-[9px] font-mono font-semibold tracking-widest uppercase rounded-sm border border-zinc-200 cursor-pointer select-none transition-colors duration-150"
                        >
                          Not Interested
                        </button>
                        {item.status === "Plan to Watch" && (
                          <button
                            type="button"
                            title="Mark as Watched"
                            onClick={() => handleQuickMarkWatched(item)}
                            className="bg-zinc-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 text-zinc-600 px-2.5 py-1.5 text-[9px] font-mono font-semibold tracking-widest uppercase rounded-sm border border-zinc-200 cursor-pointer select-none transition-colors duration-150"
                          >
                            Watched
                          </button>
                        )}
                      </>
                    )}
                    {item.mediaType === "universe" ? (
                      <Link
                        href={`/universes/${item.slug}`}
                        onClick={() => sound.play("click")}
                        className="bg-zinc-900 hover:bg-zinc-800 text-white px-2.5 py-1.5 text-[9px] font-mono font-semibold tracking-widest uppercase rounded-sm border border-zinc-900 cursor-pointer select-none transition-colors duration-150 text-center inline-block"
                      >
                        Edit
                      </Link>
                    ) : (
                      <button
                        type="button"
                        title="Edit"
                        onClick={() => {
                          sound.play("click");
                          openEdit(item);
                        }}
                        className="bg-zinc-900 hover:bg-zinc-800 text-white px-2.5 py-1.5 text-[9px] font-mono font-semibold tracking-widest uppercase rounded-sm border border-zinc-900 cursor-pointer select-none transition-colors duration-150"
                      >
                        Edit
                      </button>
                    )}
                    <button
                      type="button"
                      title="Delete"
                      onClick={() => handleDeleteItem(item)}
                      className="bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 px-2.5 py-1.5 text-[9px] font-mono font-semibold tracking-widest uppercase rounded-sm border border-red-200 cursor-pointer select-none transition-colors duration-150"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {visibleItems.map((item) => {
            const isDismissed = item.tags?.includes("not-interested");
            return (
              <div key={item._id} className={`relative group rounded-sm overflow-hidden border bg-white hover:shadow-md transition-all duration-300 ease-out ${
                isDismissed
                  ? "border-red-100 opacity-50 hover:opacity-80 grayscale hover:grayscale-0"
                  : "border-zinc-200 hover:border-zinc-400"
              }`}>
              <Link
                href={item.mediaType === "universe" ? `/universes/${item.slug}` : `/media/${item.mediaType}/${item.tmdbId}`}
                onMouseEnter={() => {
                  sound.play("hover");
                  window.dispatchEvent(
                    new CustomEvent("oscilloscope-active", { detail: { active: true } })
                  );
                }}
                onMouseLeave={() => {
                  window.dispatchEvent(
                    new CustomEvent("oscilloscope-active", { detail: { active: false } })
                  );
                }}
                onClick={() => sound.play("click")}
                className="block overflow-hidden"
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

                  {/* Slide-up metadata overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-zinc-950/90 text-white text-[9px] font-mono tracking-wider uppercase px-3 py-2 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out flex justify-between items-center select-none z-10 border-t border-zinc-800">
                    <span>★ {item.rating ? `${item.rating}/10` : "UNRATED"}</span>
                    <span>{item.releaseYear ?? "—"}</span>
                  </div>
                </div>
                <div className="p-3.5 border-t border-zinc-100 flex flex-col gap-1.5">
                  <h3 className="font-sans font-bold text-xs uppercase tracking-wide text-zinc-900 group-hover:text-zinc-950 group-hover:underline decoration-1 underline-offset-2 transition-colors line-clamp-2 leading-snug">
                    {item.title}
                  </h3>
                  
                  <div className="flex flex-wrap items-center gap-1.5 mt-1 select-none">
                    <span className={`text-[9px] font-mono font-semibold px-2 py-0.5 border uppercase rounded-sm ${getStatusBadgeStyle(item.status)}`}>
                      {item.status}
                    </span>
                    <span className={`text-[9px] font-mono font-semibold px-2 py-0.5 border uppercase rounded-sm ${
                      item.mediaType === "tv"
                        ? "bg-[#00E5FF] text-zinc-950 border-[#00E5FF]/30"
                        : item.mediaType === "universe"
                        ? "bg-red-600 text-white border-red-600/30"
                        : "bg-[#FF5722] text-white border-[#FF5722]/30"
                    }`}>
                      {item.mediaType}
                    </span>
                  </div>

                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5 select-none">
                      {item.tags.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="text-[8px] font-mono text-zinc-500 bg-zinc-100/60 px-1 py-0.5 border border-zinc-200/50 rounded-sm uppercase tracking-wide truncate max-w-[80px]"
                          title={t}
                        >
                          {t}
                        </span>
                      ))}
                      {item.tags.length > 3 && (
                        <span className="text-[8px] font-mono text-zinc-400 bg-zinc-50 px-1 py-0.5 border border-dashed border-zinc-200/50 rounded-sm uppercase tracking-wide">
                          +{item.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </Link>

              {/* Quick action overlay — appears on hover */}
              <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 z-20">
                {item.mediaType !== "universe" && (
                  <>
                    {/* Not Interested — always visible */}
                    <button
                      type="button"
                      title="Not Interested"
                      onMouseEnter={() => sound.play("hover")}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQuickNotInterested(item);
                      }}
                      className="bg-zinc-950/85 hover:bg-red-600 text-white w-6 h-6 flex items-center justify-center border border-zinc-800/80 rounded-sm cursor-pointer select-none transition-colors duration-150 font-sans text-[11px] font-bold shadow-md"
                    >
                      ✕
                    </button>
                    {/* Mark Watched — only for unwatched items */}
                    {item.status === "Plan to Watch" && (
                      <button
                        type="button"
                        title="Mark as Watched"
                        onMouseEnter={() => sound.play("hover")}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickMarkWatched(item);
                        }}
                        className="bg-zinc-950/85 hover:bg-emerald-600 text-white w-6 h-6 flex items-center justify-center border border-zinc-800/80 rounded-sm cursor-pointer select-none transition-colors duration-150 font-sans text-[11px] font-bold shadow-md"
                      >
                        ✓
                      </button>
                    )}
                  </>
                )}
                {/* Edit & Delete */}
                {item.mediaType === "universe" ? (
                  <>
                    <Link
                      href={`/universes/${item.slug}`}
                      onMouseEnter={() => sound.play("hover")}
                      onClick={(e) => {
                        e.stopPropagation();
                        sound.play("click");
                      }}
                      className="bg-zinc-900 hover:bg-zinc-800 text-white px-2 py-1 text-[9px] font-mono font-semibold tracking-widest uppercase rounded-sm shadow-md cursor-pointer select-none transition-colors duration-150 text-center inline-block"
                    >
                      EDIT
                    </Link>
                    <button
                      type="button"
                      title="Delete"
                      onMouseEnter={() => sound.play("hover")}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteItem(item);
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 text-[9px] font-mono font-semibold tracking-widest uppercase rounded-sm shadow-md cursor-pointer select-none transition-colors duration-150"
                    >
                      DELETE
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    title="Edit"
                    onMouseEnter={() => sound.play("hover")}
                    onClick={(e) => {
                      e.stopPropagation();
                      sound.play("click");
                      openEdit(item);
                    }}
                    className="bg-zinc-900 hover:bg-zinc-800 text-white px-2 py-1 text-[9px] font-mono font-semibold tracking-widest uppercase rounded-sm shadow-md cursor-pointer select-none transition-colors duration-150"
                  >
                    EDIT
                  </button>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}

      {editItem && (
        <WatchlistModal
          open={modalOpen}
          onClose={() => {
            sound.play("click");
            setModalOpen(false);
            setEditItem(null);
          }}
          media={{
            tmdbId: editItem.tmdbId,
            mediaType: editItem.mediaType as "movie" | "tv",
            title: editItem.title,
            posterPath: editItem.posterPath,
            releaseYear: editItem.releaseYear,
          }}
          existingItem={editItem as any}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
