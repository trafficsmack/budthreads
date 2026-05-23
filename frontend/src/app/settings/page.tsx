"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { CheckCircle2, XCircle, Eye, EyeOff, Save, Loader2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const fetcher = (url: string) => fetch(url).then((r) => r.json());

const MASK = "••••••••";

function StatusBadge({ connected }: { connected: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
      connected ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
    )}>
      {connected
        ? <><CheckCircle2 className="w-3.5 h-3.5" /> Connected</>
        : <><XCircle className="w-3.5 h-3.5" /> Not connected</>}
    </span>
  );
}

function SecretField({ label, value, onChange, placeholder, hint }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-xs font-semibold text-navy/60 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className="w-full px-3 py-2 pr-10 text-sm rounded-lg border border-cream-dark bg-white text-navy placeholder:text-navy/30 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold transition-colors"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-navy/30 hover:text-navy/60 transition-colors"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {hint && <p className="mt-1 text-xs text-navy/40">{hint}</p>}
    </div>
  );
}

function TextField({ label, value, onChange, placeholder, hint }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string | React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-navy/60 mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className="w-full px-3 py-2 text-sm rounded-lg border border-cream-dark bg-white text-navy placeholder:text-navy/30 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold transition-colors"
      />
      {hint && <p className="mt-1 text-xs text-navy/40">{hint}</p>}
    </div>
  );
}

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { data: status, mutate: mutateStatus } = useSWR(
    `${API_URL}/api/settings/status`, fetcher, { refreshInterval: 5000 }
  );
  const { data: stored, mutate: mutateStored } = useSWR(`${API_URL}/api/settings`, fetcher);

  const [token, setToken] = useState("");
  const [pageId, setPageId] = useState("61588731239780");
  const [igId, setIgId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill from stored values (skip masked secrets)
  useEffect(() => {
    if (!stored) return;
    if (stored.meta_facebook_page_id && !stored.meta_facebook_page_id.startsWith("•"))
      setPageId(stored.meta_facebook_page_id);
    if (stored.meta_instagram_account_id && !stored.meta_instagram_account_id.startsWith("•"))
      setIgId(stored.meta_instagram_account_id);
  }, [stored]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const settings: Record<string, string> = {};
      if (token && !token.startsWith("•")) settings.meta_access_token = token.trim();
      if (pageId.trim()) settings.meta_facebook_page_id = pageId.trim();
      if (igId.trim()) settings.meta_instagram_account_id = igId.trim();

      const res = await fetch(`${API_URL}/api/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaved(true);
      mutateStatus();
      mutateStored();
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const metaConnected = status?.meta;
  const igConnected = status?.meta_instagram;

  return (
    <div className="p-8 max-w-xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-navy mb-1">Settings</h1>
        <p className="text-sm text-navy/60">Connect your accounts to start publishing.</p>
      </div>

      <div className="card space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1877F2]/10 flex items-center justify-center text-xl">📘</div>
            <div>
              <h2 className="font-bold text-navy text-base leading-tight">Meta</h2>
              <p className="text-xs text-navy/50">Instagram &amp; Facebook</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-navy/40">Facebook</span>
              <StatusBadge connected={!!metaConnected} />
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-navy/40">Instagram</span>
              <StatusBadge connected={!!igConnected} />
            </div>
          </div>
        </div>

        <hr className="border-cream-dark" />

        {/* Fields */}
        <SecretField
          label="Page Access Token"
          value={token}
          onChange={setToken}
          placeholder={stored?.meta_access_token ? MASK : "Paste your token…"}
          hint="From Meta Business Manager → System Users → Generate Token"
        />

        <TextField
          label="Facebook Page ID"
          value={pageId}
          onChange={setPageId}
          placeholder="e.g. 61588731239780"
        />

        <TextField
          label="Instagram Business Account ID"
          value={igId}
          onChange={setIgId}
          placeholder="e.g. 17841400000000000"
          hint={
            <span>
              Find in{" "}
              <a
                href="https://business.facebook.com/latest/instagram_content_publishing"
                target="_blank"
                rel="noopener noreferrer"
                className="underline inline-flex items-center gap-0.5 hover:text-navy/70"
              >
                Meta Business Suite
                <ExternalLink className="w-3 h-3" />
              </a>
              {" "}→ Instagram → Settings → Account ID. Or ask us to look it up below.
            </span>
          }
        />

        {/* Lookup button */}
        {metaConnected && !igConnected && (
          <LookupInstagramId onFound={(id) => { setIgId(id); }} />
        )}

        {/* Save */}
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary w-full justify-center"
        >
          {saving
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
            : saved
            ? <><CheckCircle2 className="w-4 h-4" /> Saved</>
            : <><Save className="w-4 h-4" /> Save credentials</>}
        </button>
      </div>
    </div>
  );
}

function LookupInstagramId({ onFound }: { onFound: (id: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lookup() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/settings/meta/lookup-instagram`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ig_id) throw new Error(data.detail || "Not found");
      onFound(data.ig_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={lookup}
        disabled={loading}
        className="btn-secondary text-sm"
      >
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Looking up…</> : "Auto-detect Instagram Account ID"}
      </button>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  );
}
