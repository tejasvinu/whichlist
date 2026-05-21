import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LibraryGrid } from "@/components/LibraryGrid";
import { Block } from "@/components/Block";

export default async function LibraryPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/library");
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <Block
        className="bg-white border border-zinc-200"
        header={
          <>
            <span>Module 02</span>
            <span className="text-red-600 font-semibold">Your List</span>
          </>
        }
      >
        <h1 className="font-sans font-black text-4xl md:text-5xl uppercase tracking-tighter text-zinc-900">
          My List
        </h1>
        <p className="text-sm text-zinc-500 font-medium mt-2">
          Welcome back, {session.user.name ?? session.user.email}. Filter, sort, and curate your personal cinema library.
        </p>
      </Block>

      <LibraryGrid />
    </div>
  );
}
