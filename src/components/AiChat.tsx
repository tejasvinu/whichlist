"use client";

import { useState, useRef, useEffect } from "react";
import { sound } from "@/lib/audio";

interface Message {
  role: "user" | "assistant";
  content: string;
}

function TypewriterText({ text, speed = 10 }: { text: string; speed?: number }) {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    setDisplayedText("");
    let idx = 0;
    const interval = setInterval(() => {
      if (idx < text.length) {
        setDisplayedText((prev) => prev + text.charAt(idx));
        idx++;
      } else {
        clearInterval(interval);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  return <span>{displayedText}</span>;
}

export function AiChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "WHICHLIST ASSISTANT ONLINE. LIST COMPATIBILITY MODE ACTIVE. STATE YOUR QUERY.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  // Keep track of page reload state or session events to refresh library context
  useEffect(() => {
    function handleUpdate() {
      // Library updated, reset assistant chat or inject notification if appropriate
    }
    window.addEventListener("watchlist-updated", handleUpdate);
    return () => window.removeEventListener("watchlist-updated", handleUpdate);
  }, []);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    sound.play("click");
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          history: messages.slice(1), // omit the initial prompt setup message
        }),
      });

      if (!res.ok) throw new Error("Connection failed");
      const data = await res.json();
      
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply ?? "SYSTEM MALFUNCTION. DISCONNECTED." },
      ]);
      sound.play("success");
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "ERROR: TELEMETRY RETRIEVAL TIMEOUT." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 font-mono">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes crt-flicker {
          0% { opacity: 0.99; }
          50% { opacity: 1; }
          100% { opacity: 0.995; }
        }
        .crt-screen {
          position: relative;
          overflow: hidden;
          animation: crt-flicker 0.25s infinite;
        }
        .crt-screen::before {
          content: " ";
          display: block;
          position: absolute;
          top: 0; left: 0; bottom: 0; right: 0;
          background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.05) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.015), rgba(0, 255, 0, 0.005), rgba(0, 0, 255, 0.015));
          z-index: 40;
          background-size: 100% 3px, 3px 100%;
          pointer-events: none;
        }
      `}} />

      {!open ? (
        <button
          type="button"
          onMouseEnter={() => sound.play("hover")}
          onClick={() => {
            sound.play("click");
            setOpen(true);
          }}
          className="bg-zinc-950 text-white border border-zinc-800 px-4 py-2 text-xs tracking-wider uppercase flex items-center gap-2 hover:bg-zinc-900 transition-colors shadow-xl cursor-pointer rounded-sm select-none"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
          </span>
          <span>[SYSTEM: ASSISTANT]</span>
        </button>
      ) : (
        <div className="w-80 sm:w-96 h-100 bg-white border border-zinc-300 shadow-2xl flex flex-col rounded-sm overflow-hidden animate-fade-in crt-screen">
          {/* Header */}
          <div className="px-4 py-3 bg-zinc-950 text-white flex justify-between items-center select-none border-b border-zinc-800">
            <span className="text-[10px] tracking-widest uppercase flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
              </span>
              whichlist Assistant v1.0
            </span>
            <button
              type="button"
              onClick={() => {
                sound.play("click");
                setOpen(false);
              }}
              className="text-zinc-400 hover:text-white text-xs cursor-pointer"
            >
              [MINIMIZE]
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-zinc-50/50">
            {messages.map((msg, index) => {
              const isUser = msg.role === "user";
              const isLastMessage = index === messages.length - 1;
              return (
                <div key={index} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                  <span className="text-[8px] text-zinc-400 uppercase mb-0.5 tracking-wider select-none font-bold">
                    {isUser ? "USER" : "ASSISTANT"}
                  </span>
                  <div
                    className={`max-w-[85%] px-3 py-2 text-xs leading-relaxed border rounded-sm ${
                      isUser
                        ? "bg-zinc-900 border-zinc-900 text-white shadow-sm"
                        : "bg-white border-zinc-200 text-zinc-800 shadow-sm"
                    }`}
                  >
                    {!isUser && isLastMessage ? (
                      <TypewriterText text={msg.content} />
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              );
            })}
            {loading && (
              <div className="flex flex-col items-start">
                <span className="text-[8px] text-zinc-400 uppercase mb-0.5 tracking-wider select-none font-bold">
                  ASSISTANT
                </span>
                <div className="bg-white border border-zinc-200 text-zinc-400 px-3 py-2 text-xs rounded-sm animate-pulse">
                  SCANNING LIST DATA...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input form */}
          <form onSubmit={handleSend} className="p-3 border-t border-zinc-200 bg-white flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="ASK ABOUT A MOVIE OR YOUR ARCHETYPE..."
              disabled={loading}
              className="flex-1 border border-zinc-200 px-3 py-2 text-[10px] tracking-wide rounded-sm focus:outline-none focus:border-zinc-400 transition-colors uppercase disabled:opacity-50 text-zinc-800"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-zinc-900 hover:bg-zinc-800 text-white px-3 text-[10px] font-bold tracking-widest uppercase transition-all duration-200 rounded-sm disabled:opacity-50 cursor-pointer select-none"
            >
              SEND
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
