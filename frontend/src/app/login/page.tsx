"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Beer, Loader2, Lock } from "lucide-react";
import { setToken } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Invalid password");
      setToken(data.token);
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-navy rounded-xl flex items-center justify-center">
            <Beer className="w-6 h-6 text-gold" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-navy font-bold text-lg leading-none">Vintage Bud</p>
            <p className="text-navy/60 text-sm font-medium">Threads</p>
          </div>
        </div>

        {/* Card */}
        <div className="card">
          <div className="flex items-center gap-2 mb-6">
            <Lock className="w-4 h-4 text-navy/40" />
            <h1 className="text-base font-bold text-navy">Sign in</h1>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-navy/60 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                placeholder="Enter your password"
                autoFocus
                className="w-full px-3 py-2 text-sm rounded-lg border border-cream-dark bg-white text-navy placeholder:text-navy/30 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold transition-colors"
              />
            </div>

            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="btn-primary w-full justify-center"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</> : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
