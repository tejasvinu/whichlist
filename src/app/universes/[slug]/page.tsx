import { UniverseDetailClient } from "./UniverseDetailClient";
import { connectDB } from "@/lib/mongodb";
import { SharedUniverse } from "@/models/SharedUniverse";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    await connectDB();
    const universe = await SharedUniverse.findOne({ slug }).select("name").lean();
    if (universe) {
      return {
        title: `${universe.name} // whichlist`,
        description: `Canon watchlist checklist, timeline sequence, and user ratings for ${universe.name}.`,
      };
    }
  } catch (err) {
    console.error("Failed to generate metadata:", err);
  }
  return {
    title: "Cinematic Universe // whichlist",
  };
}

export default function UniverseDetailPage() {
  return <UniverseDetailClient />;
}
