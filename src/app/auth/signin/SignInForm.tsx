"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Block } from "@/components/Block";

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/library";

  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (mode === "register") {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registration failed");
        setLoading(false);
        return;
      }
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);
    if (result?.error) {
      setError(mode === "register" ? "Account created but sign-in failed" : "Invalid credentials");
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="max-w-md mx-auto space-y-8 animate-fade-in my-8">
      <Block
        className="bg-white border border-zinc-200"
        header={
          <>
            <span>Authentication</span>
            <span className="text-zinc-600 font-semibold">whichlist Access</span>
          </>
        }
      >
        <h1 className="font-sans font-black text-3xl uppercase tracking-tighter text-zinc-900 mb-6">
          {mode === "signin" ? "Sign In to whichlist" : "Create Account"}
        </h1>

        <div className="flex gap-2.5 mb-6">
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`flex-1 py-2.5 font-sans font-bold uppercase text-[10px] tracking-widest transition-all duration-200 rounded-sm border cursor-pointer ${
              mode === "signin" 
                ? "bg-zinc-900 border-zinc-900 text-white shadow-sm" 
                : "bg-zinc-50 border-zinc-200 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`flex-1 py-2.5 font-sans font-bold uppercase text-[10px] tracking-widest transition-all duration-200 rounded-sm border cursor-pointer ${
              mode === "register" 
                ? "bg-zinc-900 border-zinc-900 text-white shadow-sm" 
                : "bg-zinc-50 border-zinc-200 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleCredentials} className="space-y-4 mb-6">
          {mode === "register" && (
            <div>
              <label className="block text-[9px] font-mono font-bold uppercase mb-1.5 tracking-widest text-zinc-400 select-none">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-zinc-200 p-2.5 bg-zinc-50/50 focus:outline-none focus:bg-white focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-all duration-200 rounded-sm text-sm text-zinc-800"
              />
            </div>
          )}
          <div>
            <label className="block text-[9px] font-mono font-bold uppercase mb-1.5 tracking-widest text-zinc-400 select-none">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-zinc-200 p-2.5 bg-zinc-50/50 focus:outline-none focus:bg-white focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-all duration-200 rounded-sm text-sm text-zinc-800"
            />
          </div>
          <div>
            <label className="block text-[9px] font-mono font-bold uppercase mb-1.5 tracking-widest text-zinc-400 select-none">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-zinc-200 p-2.5 bg-zinc-50/50 focus:outline-none focus:bg-white focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-all duration-200 rounded-sm text-sm text-zinc-800"
            />
          </div>
          {error && (
            <p className="text-red-600 font-mono text-xs uppercase tracking-wider bg-red-50 border border-red-100 p-2 rounded-sm select-none">
              [error]: {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-zinc-900 text-white border border-zinc-900 py-3 font-sans font-bold text-xs tracking-widest uppercase hover:bg-white hover:text-zinc-900 transition-all duration-300 ease-out disabled:opacity-50 shadow-md shadow-zinc-950/10 cursor-pointer rounded-sm"
          >
            {loading ? "Processing..." : mode === "signin" ? "Enter whichlist" : "Create & Enter"}
          </button>
        </form>

        <div className="border-t border-zinc-100 pt-6 mt-6">
          <p className="text-[9px] font-mono font-bold uppercase mb-3.5 tracking-widest text-zinc-400 select-none">Or connect via Provider</p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => signIn("google", { callbackUrl })}
              className="w-full border border-zinc-200 py-2.5 font-sans font-semibold text-xs tracking-wide uppercase text-zinc-700 bg-zinc-50/20 hover:bg-zinc-50 hover:text-zinc-900 hover:border-zinc-300 transition-all duration-200 rounded-sm cursor-pointer"
            >
              Google Account
            </button>
            <button
              type="button"
              onClick={() => signIn("github", { callbackUrl })}
              className="w-full border border-zinc-200 py-2.5 font-sans font-semibold text-xs tracking-wide uppercase text-zinc-700 bg-zinc-50/20 hover:bg-zinc-50 hover:text-zinc-900 hover:border-zinc-300 transition-all duration-200 rounded-sm cursor-pointer"
            >
              GitHub account
            </button>
          </div>
        </div>
      </Block>

      <p className="text-center text-xs">
        <Link href="/" className="font-mono font-bold uppercase tracking-wider text-zinc-400 hover:text-zinc-900 hover:underline underline-offset-4 decoration-1 transition-all">
          ← Back to trending
        </Link>
      </p>
    </div>
  );
}
