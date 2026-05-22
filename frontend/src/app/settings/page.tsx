"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import {
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Save,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const fetcher = (url: string) => fetch(url).then((r) => r.json());

const META_FIELDS = [
  { key: "meta_app_id", label: "App ID", placeholder: "123456789012345", sensitive: false },
  { key: "meta_app_secret", label: "App Secret", placeholder: "••••••••", sensitive: true },
  { key: "meta_access_token", label: "Page Access Token", placeholder: "EAAxxxxx…", sensitive: true },
  { key: "meta_instagram_account_id", label: "Instagram Account ID", placeholder: "17841400000000000", sensitive: false },
  { key: "meta_facebook_page_id", label: "Facebook Page ID", placeholder: "100000000000000", sensitive: false },
] as const;

type MetaKey = typeof META_FIELDS[number]["key"];

interface StatusBadgeProps {
  connected: boolean;
  label: string;
}

function StatusBadge({ connected, label }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
        connected
          ? "bg-green-100 text-green-700"
          : "bg-red-100 text-red-600"
      )}
    >
      {connected ? (
        <CheckCircle2 className="w-3.5 h-3.5" />
      ) : (
        <XCircle className="w-3.5 h-3.5" />
      )}
      {label}
    </span>
  );
}

export default function SettingsPage() {
  const { data: status, mutate: mutateStatus } = useSWR(
    `${API_URL}/api/settings/status`,
    fetcher,
    { refreshInterval: 8000 }
  );

  const { data: stored } = useSWR(`${API_URL}/api/settings`, fetcher);

  const [fields, setFields] = useState<Record<MetaKey, string>>({
    meta_app_id: "",
    meta_app_secret: "",
    meta_access_token: "",
    meta_instagram_account_id: "",
    meta_facebook_page_id: "",
  });

  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill from stored settings (masked values shown as-is)
  useEffect(() => {
    if (!stored) return;
    setFields((prev) => {
      const next = { ...prev };
      for (const f of META_FIELDS) {
        if (stored[f.key] !== undefined && prev[f.key] === "") {
          next[f.key] = stored[f.key];
        }
      }
      return next;
    });
  }, [stored]);

  function handleChange(key: MetaKey, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
    setSavedAt(null);
    setError(null);
  }

  function toggleReveal(key: string) {
    setRevealed((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: fields }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSavedAt(Date.now());
      mutateStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const metaConnected = status?.meta ?? false;
  const anyFilled = META_FIELDS.some((f) => {
    const val = fields[f.key];
    return val && !val.startsWith("••");
  });

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-navy mb-1">Settings</h1>
        <p className="text-sm text-navy/60">
          Connect your social media accounts to start publishing.
        </p>
      </div>

      {/* Meta Section */}
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
          <StatusBadge
            connected={metaConnected}
            label={metaConnected ? "Connected" : "Not connected"}
          />
        </div>

        {/* Instructions */}
        <div className="mb-5 p-3.5 rounded-lg bg-cream border border-cream-dark text-xs text-navy/70 leading-relaxed">
          <p className="font-semibold text-navy mb-1">How to get your credentials</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>
              Go to{" "}
              <a
                href="https://developers.facebook.com/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1877F2] underline inline-flex items-center gap-0.5"
              >
                developers.facebook.com/apps
                <ExternalLink className="w-3 h-3" />
              </a>{" "}
              and create or select your app.
            </li>
            <li>
              Use the{" "}
              <a
                href="https://developers.facebook.com/tools/explorer/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1877F2] underline inline-flex items-center gap-0.5"
              >
                Graph API Explorer
                <ExternalLink className="w-3 h-3" />
              </a>{" "}
              to generate a <strong>Page Access Token</strong> with permissions:{" "}
              <code className="bg-cream-dark px-1 rounded">pages_manage_posts</code>,{" "}
              <code className="bg-cream-dark px-1 rounded">instagram_basic</code>,{" "}
              <code className="bg-cream-dark px-1 rounded">instagram_content_publish</code>.
            </li>
            <li>
              Find your Instagram Business Account ID via:
              <br />
              <code className="bg-cream-dark px-1 rounded mt-0.5 inline-block">
                GET /&#123;page-id&#125;?fields=instagram_business_account
              </code>
            </li>
          </ol>
        </div>

        {/* Fields */}
        <div className="space-y-4">
          {META_FIELDS.map((f) => {
            const isSensitive = f.sensitive;
            const isRevealed = revealed[f.key];
            const inputType = isSensitive && !isRevealed ? "password" : "text";

            return (
              <div key={f.key}>
                <label className="block text-xs font-semibold text-navy/70 mb-1.5">
                  {f.label}
                </label>
                <div className="relative">
                  <input
                    type={inputType}
                    value={fields[f.key]}
                    onChange={(e) => handleChange(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className={cn(
                      "w-full px-3 py-2 text-sm rounded-lg border border-cream-dark bg-white",
                      "text-navy placeholder:text-navy/30 focus:outline-none focus:ring-2",
                      "focus:ring-gold/40 focus:border-gold transition-colors",
                      isSensitive && "pr-10"
                    )}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {isSensitive && (
                    <button
                      type="button"
                      onClick={() => toggleReveal(f.key)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-navy/30 hover:text-navy/60 transition-colors"
                    >
                      {isRevealed ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between">
          <div className="text-xs">
            {error && <span className="text-red-500">{error}</span>}
            {savedAt && !error && (
              <span className="text-green-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Saved
              </span>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !anyFilled}
            className="btn-primary text-sm"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save credentials
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
