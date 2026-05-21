export function Marquee() {
  const text =
    "whichlist  //  THE MATRIX [WATCHING]  //  SUCCESSION [COMPLETED]  //  DUNE [PLAN TO WATCH]  //  ";

  return (
    <div className="w-full overflow-hidden whitespace-nowrap border-t border-b border-zinc-200 bg-zinc-50/50 py-3 font-mono text-[10px] tracking-widest text-zinc-500 uppercase mt-12 select-none flex">
      <div className="marquee-inner inline-flex">
        <span>{text.repeat(3)}</span>
        <span>{text.repeat(3)}</span>
      </div>
    </div>
  );
}
