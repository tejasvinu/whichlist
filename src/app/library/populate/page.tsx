import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PopulateClient } from "./PopulateClient";

export default async function PopulatePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/library/populate");
  }

  return <PopulateClient />;
}
