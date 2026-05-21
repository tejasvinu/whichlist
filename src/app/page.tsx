import Link from "next/link";
import { getTrending } from "@/lib/tmdb";
import { MediaCard } from "@/components/MediaCard";
import { Block } from "@/components/Block";
import { SystemVisualizer } from "@/components/SystemVisualizer";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  let results: Awaited<ReturnType<typeof getTrending>>["results"] = [];
  const session = await auth();

  try {
    const data = await getTrending();
    results = data.results.filter(
      (r) => r.media_type === "movie" || r.media_type === "tv"
    );
  } catch {
    results = [];
  }

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Editorial Grid Poster */}
      <div className="grid grid-cols-1 md:grid-cols-4 border border-zinc-200 bg-zinc-200 gap-px shadow-sm rounded-sm overflow-hidden">
        <Block
          flat
          className="md:col-span-3 md:row-span-2 bg-white"
          header={
            <>
              <span>001</span>
              <span className="text-red-600 font-semibold">Manifesto</span>
            </>
          }
        >
          <h1 className="font-sans font-black text-5xl md:text-8xl lg:text-9xl uppercase tracking-tighter leading-[0.82] text-zinc-950 my-auto py-4">
            TRACK.
            <br />
            RATE.
            <br />
            ORGANIZE.
          </h1>
        </Block>

        <Block
          flat
          hover
          className="md:col-span-1 bg-white"
          header={<span>Build</span>}
        >
          <div className="my-auto">
            <h3 className="font-sans font-black text-4xl mb-1 text-zinc-900 tracking-tight">V 1.0.0</h3>
            <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">Next.js / MongoDB</p>
          </div>
        </Block>

        <div className="md:col-span-1 bg-white">
          <SystemVisualizer flat />
        </div>

        <Block flat hover className="md:col-span-2 bg-white" header={<span>Synopsis</span>}>
          <p className="text-base font-medium leading-relaxed text-zinc-700 my-auto">
            Not your average tracker. A personalized, ad-free, deeply robust web application to
            curate your cinematic universe. Built on structural fundamentals, supercharged for visual clarity.
          </p>
        </Block>

        <Link href={session ? "/library" : "/auth/signin"} className="md:col-span-2 block h-full">
          <Block flat className="bg-zinc-950 text-white h-full" hover>
            <h2 className="font-sans font-extrabold text-2xl md:text-3xl uppercase tracking-tight text-center text-white hover:text-red-500 transition-colors py-4 my-auto">
              {session ? "GO TO YOUR LIST →" : "GET STARTED →"}
            </h2>
          </Block>
        </Link>
      </div>

      {/* Editorial section header */}
      <div className="bg-zinc-50 border border-zinc-200 p-4 font-mono text-[10px] tracking-widest uppercase flex justify-between select-none rounded-sm text-zinc-500">
        <span>PHASE 01</span>
        <span>Trending // TMDB MAINFRAME</span>
      </div>

      {results.length === 0 ? (
        <Block>
          <p className="font-mono text-xs uppercase tracking-wider text-center py-6 text-zinc-400">
            Configure TMDB_API_KEY in .env.local to load trending media.
          </p>
        </Block>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {results.slice(0, 18).map((item) => (
            <MediaCard key={`${item.media_type}-${item.id}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
