"use client";

import { useState, useRef, useEffect } from "react";
import { sound } from "@/lib/audio";

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}

export function CustomSelect({ label, value, options, onChange }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = () => {
    sound.play("click");
    setIsOpen(!isOpen);
  };

  const handleSelect = (val: string) => {
    sound.play("click");
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div className="flex flex-col relative w-full" ref={containerRef}>
      <label className="block text-[9px] font-mono font-bold uppercase mb-1.5 tracking-widest text-zinc-400 select-none">
        {label}
      </label>
      <button
        type="button"
        onClick={handleToggle}
        onMouseEnter={() => sound.play("hover")}
        className="w-full border border-zinc-950 px-3.5 py-2 text-xs font-mono font-bold uppercase bg-white text-zinc-800 focus:outline-none transition-all duration-200 rounded-sm cursor-pointer flex justify-between items-center select-none"
      >
        <span>{selectedOption ? selectedOption.label : ""}</span>
        <span className="text-[9px] text-zinc-500 ml-2">▼</span>
      </button>
      {isOpen && (
        <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-white border border-zinc-950 shadow-md rounded-sm overflow-hidden py-1">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onMouseEnter={() => sound.play("hover")}
              onClick={() => handleSelect(opt.value)}
              className={`w-full text-left px-3.5 py-2 text-xs font-mono uppercase transition-colors duration-150 cursor-pointer ${
                opt.value === value
                  ? "bg-zinc-900 text-white font-bold"
                  : "bg-white text-zinc-800 hover:bg-zinc-100"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
