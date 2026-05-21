import { ReactNode } from "react";

interface BlockProps {
  children: ReactNode;
  className?: string;
  header?: ReactNode;
  hover?: boolean;
  flat?: boolean;
}

export function Block({ children, className = "", header, hover = false, flat = false }: BlockProps) {
  const hasBg = className.split(" ").some((cls) => cls.startsWith("bg-"));
  return (
    <div
      className={`${
        hasBg ? "" : "bg-white text-zinc-950"
      } ${
        flat 
          ? "border-0 shadow-none" 
          : "border border-zinc-200 shadow-sm"
      } flex flex-col overflow-hidden transition-all duration-300 ${
        hover && !flat 
          ? "hover:border-zinc-400 hover:shadow-md cursor-pointer" 
          : ""
      } ${
        hover && flat 
          ? "hover:bg-zinc-50 cursor-pointer" 
          : ""
      } ${className}`}
    >
      {header && (
        <div className="px-6 py-2.5 border-b border-zinc-200 bg-zinc-50 text-zinc-500 font-mono text-[10px] tracking-widest uppercase flex justify-between items-center select-none">
          {header}
        </div>
      )}
      <div className="p-6 flex-grow flex flex-col">{children}</div>
    </div>
  );
}
