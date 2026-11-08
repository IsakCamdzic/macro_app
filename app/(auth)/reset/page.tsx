"use client";

import { useState } from "react";
import Link from "next/link";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-center px-margin py-12">
      <div className="max-w-sm mx-auto w-full flex flex-col gap-space-lg">
        <div className="flex flex-col items-center text-center">
          <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface tracking-tight">
            Reset Password
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
            Enter your email to receive a secure recovery link
          </p>
        </div>

        <div className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm border border-surface-container-high flex flex-col gap-4">
          {submitted ? (
            <div className="p-4 rounded-xl bg-primary-fixed text-on-primary-fixed text-xs font-medium text-center">
              If an account exists for {email}, a recovery link has been sent.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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

              <button
                type="submit"
                className="mt-2 w-full h-11 rounded-xl bg-primary text-on-primary font-semibold text-sm shadow-md hover:opacity-90 active:scale-95 transition-all"
              >
                Send Recovery Link
              </button>
            </form>
          )}

          <div className="text-center">
            <Link href="/sign-in" className="text-xs text-primary font-semibold hover:underline">
              ← Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
