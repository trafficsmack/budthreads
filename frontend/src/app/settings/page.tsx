"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import useSWR from "swr";
import {
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Save,
  Loader2,
  Copy,
  Check,
  AlertCircle,
  Facebook,
} from "lucide-react";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ connected }: { connected: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
        connected ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
      )}
    >
      {connected ? (
        <CheckCircle2 className="w-3.5 h-3.5" />
      ) : (
        <XCircle className="w-3.5 h-3.5" />
      )}
      {connected ? "Connected" : "Not connected"}
    </span>
  );
}

function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <p className="text-xs font-semibold text-navy/60 mb-1.5">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 px-3 py-2 text-xs bg-cream border border-cream-dark rounded-lg text-navy/70 truncate">
          {value}
        </code>
        <button
          onClick={copy}
          className="flex-shrink-0 p-2 rounded-lg border border-cream-dark bg-white hover:bg-cream text-navy/50 hover:text-navy transition-colors"
          title="Copy"
        >
          {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function SecretInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
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
    </div>
  );
}

// ── Page selection modal (multi-page accounts) ────────────────────────────────

function PageSelectModal({
  pages,
  onSelect,
  selecting,
}: {
  pages: { id: string; name: string }[];
  onSelect: (id: string) => void;
  selecting: string | null;
}) {
  return (
    <div className="fixed inset-0 bg-navy/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
        <h3 className="font-bold text-navy text-base mb-1">Choose a Facebook Page</h3>
        <p className="text-sm text-navy/60 mb-4">
          Your account manages multiple pages. Which one should we connect?
        </p>
        <div className="space-y-2">
          {pages.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              disabled={!!selecting}
              className={cn(
                "w-full text-left px-4 py-3 rounded-xl border transition-colors",
                selecting === p.id
                  ? "border-gold bg-gold/10"
                  : "border-cream-dark hover:border-gold/50 hover:bg-cream"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-navy">{p.name}</span>
                {selecting === p.id && <Loader2 className="w-4 h-4 animate-spin text-gold" />}
              </div>
              <span className="text-xs text-navy/40">{p.id}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Manual token entry ────────────────────────────────────────────────────────

function ManualTokenSection({
  pageId,
  onSuccess,
}: {
  pageId: string;
  onSuccess: (page: string, ig: boolean) => void;
}) {
  const [token, setToken] = useState("");
  const [manualPageId, setManualPageId] = useState(pageId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);

  async function handleSave() {
    if (!token.trim() || !manualPageId.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_URL}/api/settings/meta/setup-from-token?access_token=${encodeURIComponent(token.trim())}&page_id=${encodeURIComponent(manualPageId.trim())}`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to save");
      onSuccess(data.page, data.ig);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save token");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="space-y-3">
        <SecretInput
          label="Page Access Token"
          value={token}
          onChange={(v) => { setToken(v); setError(null); }}
          placeholder="Paste your token here…"
        />
        <div>
          <label className="block text-xs font-semibold text-navy/60 mb-1.5">Facebook Page ID</label>
          <input
            type="text"
            value={manualPageId}
            onChange={(e) => setManualPageId(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-cream-dark bg-white text-navy placeholder:text-navy/30 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold transition-colors"
          />
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      <button
        onClick={handleSave}
        disabled={saving || !token.trim()}
        className="btn-primary text-sm mt-4 w-full justify-center"
      >
        {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save & verify token</>}
      </button>
    </div>
  );
}

// ── Main settings content ─────────────────────────────────────────────────────

function SettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const { data: status, mutate: mutateStatus } = useSWR(
    `${API_URL}/api/settings/status`,
    fetcher,
    { refreshInterval: 6000 }
  );
  const { data: storedSettings } = useSWR(`${API_URL}/api/settings`, fetcher);
  const { data: pendingPages, mutate: mutatePending } = useSWR(
    searchParams.get("select_page") ? `${API_URL}/api/settings/meta/pending-pages` : null,
    fetcher
  );

  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedCreds, setSavedCreds] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [selectingPage, setSelectingPage] = useState<string | null>(null);
  const [manualPageId, setManualPageId] = useState("");
  const [connectingPage, setConnectingPage] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  // Banners from OAuth redirect params
  const connectedParam = searchParams.get("connected");
  const pageName = searchParams.get("page");
  const igLinked = searchParams.get("ig") === "1";
  const errorParam = searchParams.get("error");
  const selectPage = searchParams.get("select_page");
  const enterPageId = searchParams.get("enter_page_id");

  // Pre-fill App ID and Page ID from stored settings
  useEffect(() => {
    if (!storedSettings) return;
    if (storedSettings.meta_app_id && !storedSettings.meta_app_id.startsWith("•") && appId === "") {
      setAppId(storedSettings.meta_app_id);
    }
    if (storedSettings.meta_facebook_page_id && !storedSettings.meta_facebook_page_id.startsWith("•") && manualPageId === "") {
      setManualPageId(storedSettings.meta_facebook_page_id);
    }
  }, [storedSettings]);

  // Clear URL params after reading them
  useEffect(() => {
    if (connectedParam || errorParam) {
      const t = setTimeout(() => router.replace("/settings"), 6000);
      return () => clearTimeout(t);
    }
  }, [connectedParam, errorParam]);

  const callbackUrl = `${API_URL}/api/settings/meta/oauth/callback`;
  const metaConnected = status?.meta ?? false;
  const hasAppCreds = appId.trim() && appSecret.trim() && !appSecret.startsWith("•");

  async function saveAppCreds() {
    if (!appId.trim()) return;
    setSaving(true);
    const toSave: Record<string, string> = { meta_app_id: appId.trim() };
    if (appSecret && !appSecret.startsWith("•")) {
      toSave.meta_app_secret = appSecret.trim();
    }
    await fetch(`${API_URL}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: toSave }),
    });
    setSaving(false);
    setSavedCreds(true);
    setTimeout(() => setSavedCreds(false), 3000);
  }

  async function handleConnect() {
    setConnecting(true);
    // Save app creds first so the backend has them
    await saveAppCreds();
    // Navigate to OAuth start — the browser follows the redirect chain
    window.location.href = `${API_URL}/api/settings/meta/oauth/start`;
  }

  async function handleConnectPage() {
    if (!manualPageId.trim()) return;
    setConnectingPage(true);
    setPageError(null);
    try {
      const res = await fetch(
        `${API_URL}/api/settings/meta/connect-page?page_id=${encodeURIComponent(manualPageId.trim())}`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Connection failed");
      await mutateStatus();
      router.replace(`/settings?connected=meta&page=${encodeURIComponent(data.page)}${data.ig ? "&ig=1" : ""}`);
    } catch (e) {
      setPageError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setConnectingPage(false);
    }
  }

  async function handleSelectPage(pageId: string) {
    setSelectingPage(pageId);
    const res = await fetch(
      `${API_URL}/api/settings/meta/select-page?page_id=${pageId}`,
      { method: "POST" }
    );
    const data = await res.json();
    if (data.ok) {
      await mutateStatus();
      await mutatePending();
      router.replace(`/settings?connected=meta&page=${encodeURIComponent(data.page)}${data.ig ? "&ig=1" : ""}`);
    }
    setSelectingPage(null);
  }

  return (
    <div className="p-8 max-w-2xl">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-navy mb-1">Settings</h1>
        <p className="text-sm text-navy/60">Connect your accounts to start publishing.</p>
      </div>

      {/* OAuth success banner */}
      {connectedParam === "meta" && (
        <div className="mb-5 flex items-start gap-3 p-4 rounded-xl bg-green-50 border border-green-200 text-green-800">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Meta connected successfully!</p>
            {pageName && (
              <p className="text-green-700">
                Page: <strong>{decodeURIComponent(pageName)}</strong>
                {igLinked ? " · Instagram account linked" : " · No Instagram account found on this page"}
              </p>
            )}
          </div>
        </div>
      )}

      {/* OAuth error banner */}
      {errorParam && (
        <div className="mb-5 flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Connection failed</p>
            <p className="text-red-700">{decodeURIComponent(errorParam)}</p>
          </div>
        </div>
      )}

      {/* Manual Page ID fallback (when /me/accounts returns empty) */}
      {enterPageId && (
        <div className="mb-5 p-5 rounded-xl bg-amber-50 border border-amber-200">
          <div className="flex items-start gap-3 mb-4">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900 text-sm">One more step</p>
              <p className="text-amber-800 text-xs mt-0.5">
                Facebook authenticated successfully but couldn't auto-detect your Page.
                Enter your Facebook Page ID below to finish connecting.
              </p>
              <p className="text-amber-700 text-xs mt-1">
                Find it at <strong>facebook.com/[your-page]</strong> → About → Page transparency, or in your Page settings.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualPageId}
              onChange={(e) => { setManualPageId(e.target.value); setPageError(null); }}
              placeholder="e.g. 100000000000000"
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-amber-300 bg-white text-navy placeholder:text-navy/30 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold"
            />
            <button
              onClick={handleConnectPage}
              disabled={connectingPage || !manualPageId.trim()}
              className="btn-primary text-sm whitespace-nowrap"
            >
              {connectingPage ? <Loader2 className="w-4 h-4 animate-spin" /> : "Connect"}
            </button>
          </div>
          {pageError && <p className="mt-2 text-xs text-red-600">{pageError}</p>}
        </div>
      )}

      {/* Page select modal */}
      {selectPage && pendingPages?.pages?.length > 0 && (
        <PageSelectModal
          pages={pendingPages.pages}
          onSelect={handleSelectPage}
          selecting={selectingPage}
        />
      )}

      {/* ── Meta card ── */}
      <div className="card">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1877F2]/10 flex items-center justify-center text-xl">
              📘
            </div>
            <div>
              <h2 className="font-bold text-navy text-base leading-tight">Meta</h2>
              <p className="text-xs text-navy/50">Instagram &amp; Facebook</p>
            </div>
          </div>
          <StatusBadge connected={metaConnected} />
        </div>

        {/* Step 1 — App credentials */}
        <div className="mb-5">
          <p className="text-xs font-bold text-navy/40 uppercase tracking-widest mb-3">
            Step 1 — App credentials
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-navy/60 mb-1.5">App ID</label>
              <input
                type="text"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="123456789012345"
                autoComplete="off"
                spellCheck={false}
                className="w-full px-3 py-2 text-sm rounded-lg border border-cream-dark bg-white text-navy placeholder:text-navy/30 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold transition-colors"
              />
            </div>
            <SecretInput
              label="App Secret"
              value={appSecret}
              onChange={setAppSecret}
              placeholder="Your app secret from Meta dashboard"
            />
          </div>
          <p className="mt-2 text-xs text-navy/40">
            Find these at{" "}
            <a
              href="https://developers.facebook.com/apps"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-navy/70"
            >
              developers.facebook.com/apps
            </a>{" "}
            → your app → App settings → Basic.
          </p>
        </div>

        {/* Step 2 — Redirect URI */}
        <div className="mb-5">
          <p className="text-xs font-bold text-navy/40 uppercase tracking-widest mb-3">
            Step 2 — Add redirect URI to your Meta app
          </p>
          <CopyField
            value={callbackUrl}
            label="Copy this URL into: your Meta app → Facebook Login → Settings → Valid OAuth Redirect URIs"
          />
        </div>

        {/* Step 3 — Connect */}
        <div className="mb-5">
          <p className="text-xs font-bold text-navy/40 uppercase tracking-widest mb-3">
            Step 3 — Connect
          </p>
          <button
            onClick={handleConnect}
            disabled={connecting || !appId.trim()}
            className={cn(
              "w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl font-semibold text-sm transition-all",
              connecting || !appId.trim()
                ? "bg-[#1877F2]/40 text-white cursor-not-allowed"
                : "bg-[#1877F2] hover:bg-[#166FE5] text-white shadow-sm"
            )}
          >
            {connecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Redirecting to Facebook…
              </>
            ) : (
              <>
                <Facebook className="w-4 h-4" />
                {metaConnected ? "Reconnect with Facebook" : "Connect with Facebook"}
              </>
            )}
          </button>
          {metaConnected && !connecting && (
            <p className="mt-2 text-center text-xs text-green-600">
              Already connected — reconnect to refresh your token
            </p>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-cream-dark" />
          <span className="text-xs text-navy/30 font-medium">or paste token directly</span>
          <div className="flex-1 h-px bg-cream-dark" />
        </div>

        {/* Manual token entry */}
        <ManualTokenSection
          pageId="61588731239780"
          onSuccess={(pageName, igLinked) => {
            mutateStatus();
            router.replace(`/settings?connected=meta&page=${encodeURIComponent(pageName)}${igLinked ? "&ig=1" : ""}`);
          }}
        />
      </div>
    </div>
  );
}

// ── Page wrapper (Suspense required for useSearchParams) ──────────────────────

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  );
}
