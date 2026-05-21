"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { SearchBar } from "./SearchBar";
import { sound } from "@/lib/audio";

export function NavBar() {
  const { data: session } = useSession();
  const [time, setTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, "0");
      const m = String(now.getMinutes()).padStart(2, "0");
      const s = String(now.getSeconds()).padStart(2, "0");
      const ms = String(Math.floor(now.getMilliseconds() / 10)).padStart(2, "0");
      setTime(`${h}:${m}:${s}:${ms}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 45);
    return () => clearInterval(interval);
  }, []);

  return (
    <nav className="flex flex-col gap-4 mb-8 border border-zinc-200 bg-white/95 backdrop-blur-md text-zinc-900 p-4 md:px-8 md:py-5 md:flex-row md:justify-between md:items-center shadow-sm sticky top-0 z-40">
      <Link
        href="/"
        onMouseEnter={() => sound.play("hover")}
        onClick={() => sound.play("click")}
        className="font-sans font-black tracking-tighter text-2xl md:text-3xl uppercase text-zinc-950 hover:text-zinc-900 transition-colors select-none"
      >
        whichlist
      </Link>

      <div className="flex-1 max-w-lg mx-0 md:mx-8">
        <SearchBar />
      </div>

      <div className="flex items-center gap-6 text-xs font-semibold uppercase flex-wrap">
        <Link 
          href="/" 
          onMouseEnter={() => sound.play("hover")}
          onClick={() => sound.play("click")}
          className="text-zinc-600 hover:text-zinc-950 hover:underline underline-offset-4 decoration-1 transition-all tracking-wider"
        >
          Trending
        </Link>
        <Link 
          href="/universes" 
          onMouseEnter={() => sound.play("hover")}
          onClick={() => sound.play("click")}
          className="text-zinc-600 hover:text-zinc-950 hover:underline underline-offset-4 decoration-1 transition-all tracking-wider"
        >
          Universes
        </Link>
        {session ? (
          <>
            <Link 
              href="/library" 
              onMouseEnter={() => sound.play("hover")}
              onClick={() => sound.play("click")}
              className="text-zinc-600 hover:text-zinc-950 hover:underline underline-offset-4 decoration-1 transition-all tracking-wider"
            >
              My List
            </Link>
            <button
              type="button"
              onMouseEnter={() => sound.play("hover")}
              onClick={() => {
                sound.play("click");
                signOut();
              }}
              className="border border-zinc-300 px-3.5 py-1.5 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all duration-200 text-[11px] font-semibold tracking-wider cursor-pointer"
            >
              Sign Out
            </button>
          </>
        ) : (
          <Link
            href="/auth/signin"
            onMouseEnter={() => sound.play("hover")}
            onClick={() => sound.play("click")}
            className="bg-zinc-900 text-white px-3.5 py-1.5 hover:bg-zinc-800 transition-all duration-200 text-[11px] font-semibold tracking-wider text-center cursor-pointer"
          >
            Sign In
          </Link>
        )}
        <div className="flex items-center gap-3 min-w-[130px] justify-end border-l border-zinc-200 pl-4 h-5">
          <span
            className="hidden sm:inline font-mono text-[10px] text-zinc-400 tracking-wider"
            suppressHydrationWarning
          >
            SYS.ON // {time || "00:00:00:00"}
          </span>
          <div className="w-2.5 h-2.5 bg-[#39FF14] rounded-full status-dot shadow-sm shadow-[#39FF14]/50 animate-pulse" />
        </div>
      </div>
    </nav>
  );
}
