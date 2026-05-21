import type { Metadata } from "next";
import { Inter, Space_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/SessionProvider";
import { NavBar } from "@/components/NavBar";
import { Marquee } from "@/components/Marquee";
import { AiChat } from "@/components/AiChat";
import { auth } from "@/lib/auth";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-space-mono",
});

export const metadata: Metadata = {
  title: "whichlist",
  description: "Track, rate, and organize your movie and TV watchlists.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="en" className={`${inter.variable} ${spaceMono.variable}`}>
      <body className="min-h-screen p-6 font-sans bg-white text-zinc-900 relative animate-fade-in">
        <SessionProvider session={session}>
          <NavBar />
          <main className="max-w-[1600px] mx-auto">{children}</main>
          <Marquee />
          {session && <AiChat />}
        </SessionProvider>
      </body>
    </html>
  );
}
