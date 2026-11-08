"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // If Supabase credentials are demo/dummy, permit guest sign-in
        if (error.message.includes("fetch") || error.message.includes("Invalid API key") || error.message.includes("dummy")) {
          router.push("/today");
          return;
        }
        setErrorMsg(error.message);
      } else {
        router.push("/today");
      }
    } catch {
      router.push("/today");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSignIn = () => {
    router.push("/today");
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-center px-margin py-12">
      <div className="max-w-sm mx-auto w-full flex flex-col gap-space-lg">
        {/* Brand */}
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-on-primary font-bold shadow-md mb-3">
            <span className="material-symbols-outlined text-[28px] text-white">scale</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface tracking-tight">
            MacroMeal
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
            Precision food portioning for your exact macro targets
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm border border-surface-container-high flex flex-col gap-4">
          <h2 className="font-headline-md text-base font-semibold text-on-surface">Sign In</h2>

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-error-container text-on-error-container text-xs font-medium">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSignIn} className="flex flex-col gap-3">
            <div>
              <label className="text-[11px] font-semibold text-on-surface-variant uppercase">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1 w-full h-11 px-3 rounded-xl bg-surface-container-low border border-surface-container-high text-sm focus:outline-none focus:border-primary font-medium"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-on-surface-variant uppercase">
                  Password
                </label>
                <Link href="/reset" className="text-xs text-primary font-semibold hover:underline">
                  Forgot?
                </Link>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="mt-1 w-full h-11 px-3 rounded-xl bg-surface-container-low border border-surface-container-high text-sm focus:outline-none focus:border-primary font-medium"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full h-11 rounded-xl bg-primary text-on-primary font-semibold text-sm shadow-md hover:opacity-90 active:scale-95 transition-all"
            >
              {loading ? "Signing In..." : "Sign In"}
            </button>
          </form>

          <div className="relative flex items-center justify-center my-1">
            <div className="w-full border-t border-surface-container-high" />
            <span className="absolute bg-surface-container-lowest px-2 text-[11px] text-outline uppercase font-semibold">
              Or
            </span>
          </div>

          <button
            type="button"
            onClick={handleDemoSignIn}
            className="w-full h-11 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">bolt</span>
            <span>Instant Demo / Guest Access</span>
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-on-surface-variant">
          Don&apos;t have an account?{" "}
          <Link href="/sign-up" className="text-primary font-semibold hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
