import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Block } from "@/components/Block";
import { SwipeDeck } from "@/components/SwipeDeck";

export default async function DiscoverPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/discover");
  }

  return (
    <div className="space-y-6 md:space-y-8 animate-fade-in">
      <Block
        className="bg-white border border-zinc-200"
        header={
          <>
            <span>Module 03</span>
            <span className="text-red-600 font-semibold">Discovery Deck</span>
          </>
        }
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-sans font-black text-4xl md:text-5xl uppercase tracking-tighter text-zinc-900">
              Discover
            </h1>
            <p className="text-sm text-zinc-500 font-medium mt-2 max-w-xl">
              Swipe right to save to your watchlist, left to pass, or up to mark watched.
              Trained on your ratings and interactions using real-time taste vector shrinkage.
            </p>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-400 uppercase tracking-widest bg-zinc-50 px-3 py-1.5 border border-zinc-200 rounded-sm self-start md:self-auto">
            <span className="w-2 h-2 rounded-full bg-[#39FF14] animate-pulse" />
            <span>AI TASTE ENGINE ONLINE</span>
          </div>
        </div>
      </Block>

      <SwipeDeck />
    </div>
  );
}
