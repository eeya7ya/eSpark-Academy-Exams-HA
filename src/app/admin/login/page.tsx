"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  // Redirect if already authenticated
  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        if (d.authenticated) router.replace("/admin");
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        router.push("/admin");
      } else {
        setError(data.error || "Login failed");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[#edeae5] flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-[#5b7884]/25 border-t-[#5b7884] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#edeae5] flex items-center justify-center p-4 text-[#2b2f30]">
      <div className="relative w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#5b7884] mb-5 text-white text-2xl font-bold shadow-sm">
            e
          </div>
          <h1 className="text-2xl font-bold text-[#2b2f30] tracking-tight">
            Admin access
          </h1>
          <p className="text-[#9b958c] text-sm mt-1.5">
            eSpark Academy exams panel
          </p>
        </div>

        {/* Form card */}
        <div className="bg-white border border-[#e6e1da] rounded-2xl p-8 shadow-sm">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[#c2554d]/10 border border-[#c2554d]/20 text-[#c2554d] text-sm mb-5">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
                  clipRule="evenodd"
                />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#76716a] mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                required
                autoComplete="username"
                autoFocus
                className="w-full px-4 py-3 rounded-lg bg-white border border-[#ded7cd] text-[#2b2f30] placeholder:text-[#a8a299] focus:outline-none focus:border-[#5b7884] focus:ring-2 focus:ring-[#5b7884]/15 transition text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#76716a] mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-lg bg-white border border-[#ded7cd] text-[#2b2f30] placeholder:text-[#a8a299] focus:outline-none focus:border-[#5b7884] focus:ring-2 focus:ring-[#5b7884]/15 transition text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-lg bg-[#5b7884] hover:bg-[#4c626a] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Authenticating…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[#a8a299] text-xs mt-6">
          eSpark Academy Admin · Restricted access
        </p>
      </div>
    </div>
  );
}
