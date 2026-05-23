"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import {
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Plus,
  X,
  Send,
  Eye,
  Loader2,
  Check,
  Package,
} from "lucide-react";
import { api, Product, streamAgentResponse, AgentStreamEvent } from "@/lib/api";
import PlatformBadge from "@/components/PlatformBadge";
import PostPreview from "@/components/PostPreview";
import MediaUpload from "@/components/MediaUpload";
import { cn } from "@/lib/utils";
import { toast } from "@/components/Toaster";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
import { authedFetcher } from "@/lib/auth";
const fetcher = authedFetcher;

type Platform = "instagram" | "facebook" | "tiktok";
type Step = 1 | 2 | 3 | 4 | 5;

interface PlatformContent {
  caption: string;
  hashtags: string[];
}

const PLATFORMS: { id: Platform; label: string; icon: string; desc: string }[] = [
  { id: "instagram", label: "Instagram", icon: "📸", desc: "Square/Story posts with hashtags" },
  { id: "facebook", label: "Facebook", icon: "👥", desc: "Longer posts with engagement" },
  { id: "tiktok", label: "TikTok", icon: "🎵", desc: "Short-form video captions" },
];

const STEPS = [
  { n: 1, label: "Product" },
  { n: 2, label: "Platforms" },
  { n: 3, label: "Generate" },
  { n: 4, label: "Review" },
  { n: 5, label: "Publish" },
];

export default function ComposePage() {
  const [step, setStep] = useState<Step>(1);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(["instagram"]);
  const [toneNotes, setToneNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [streamMessages, setStreamMessages] = useState<string[]>([]);
  const [content, setContent] = useState<Record<Platform, PlatformContent>>({
    instagram: { caption: "", hashtags: [] },
    facebook: { caption: "", hashtags: [] },
    tiktok: { caption: "", hashtags: [] },
  });
  const [activeTab, setActiveTab] = useState<Platform>("instagram");
  const [newHashtag, setNewHashtag] = useState<Record<Platform, string>>({
    instagram: "",
    facebook: "",
    tiktok: "",
  });
  const [previewMode, setPreviewMode] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [publishing, setPublishing] = useState<Platform | "all" | null>(null);
  const [publishedPlatforms, setPublishedPlatforms] = useState<Platform[]>([]);

  const { data: products, isLoading: productsLoading } = useSWR<Product[]>(
    `${API_URL}/api/products`,
    fetcher
  );

  function togglePlatform(platform: Platform) {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.length > 1
          ? prev.filter((p) => p !== platform)
          : prev
        : [...prev, platform]
    );
  }

  async function handleGenerate() {
    if (!selectedProduct) return;
    setGenerating(true);
    setStreamMessages([]);

    try {
      const stream = streamAgentResponse("/api/agents/generate-content", {
        product_id: selectedProduct.id,
        platforms: selectedPlatforms,
        tone_notes: toneNotes || undefined,
      });

      const newContent = { ...content };

      for await (const event of stream) {
        const e = event as AgentStreamEvent;
        if (e.type === "progress" && e.message) {
          setStreamMessages((prev) => [...prev, e.message!]);
        }
        if (e.type === "result" && e.data) {
          const data = e.data as Record<string, unknown>;
          for (const platform of selectedPlatforms) {
            const platformData = data[platform] as
              | { caption?: string; hashtags?: string[] }
              | undefined;
            if (platformData) {
              newContent[platform] = {
                caption: platformData.caption ?? "",
                hashtags: platformData.hashtags ?? [],
              };
            }
          }
          setContent(newContent);
        }
        if (e.type === "error") {
          toast("error", "Generation Failed", e.message);
          break;
        }
      }

      setStep(4);
      setActiveTab(selectedPlatforms[0]);
    } catch {
      toast("error", "Connection Error", "Could not reach the AI agent.");
    } finally {
      setGenerating(false);
    }
  }

  async function handlePublish(platform: Platform | "all") {
    setPublishing(platform);
    const targets = platform === "all" ? selectedPlatforms : [platform];

    try {
      for (const p of targets) {
        await api.createPost({
          product_id: selectedProduct!.id,
          platform: p,
          caption: content[p].caption,
          hashtags: content[p].hashtags,
          status: "draft",
        });
        await api.publishPost("latest");
        setPublishedPlatforms((prev) => [...prev, p]);
      }
      toast("success", "Posts Published!", `Published to ${targets.join(", ")}.`);
    } catch {
      toast("error", "Publish Failed", "Some posts may not have been published.");
    } finally {
      setPublishing(null);
    }
  }

  async function handleSaveDraft() {
    if (!selectedProduct) return;
    try {
      for (const p of selectedPlatforms) {
        await api.createPost({
          product_id: selectedProduct.id,
          platform: p,
          caption: content[p].caption,
          hashtags: content[p].hashtags,
          status: "draft",
        });
      }
      toast("success", "Saved as Draft", "Your posts are saved and ready to publish.");
    } catch {
      toast("error", "Save Failed");
    }
  }

  function removeHashtag(platform: Platform, tag: string) {
    setContent((prev) => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        hashtags: prev[platform].hashtags.filter((h) => h !== tag),
      },
    }));
  }

  function addHashtag(platform: Platform) {
    const raw = newHashtag[platform].trim().replace(/^#/, "");
    if (!raw) return;
    if (!content[platform].hashtags.includes(raw)) {
      setContent((prev) => ({
        ...prev,
        [platform]: {
          ...prev[platform],
          hashtags: [...prev[platform].hashtags, raw],
        },
      }));
    }
    setNewHashtag((prev) => ({ ...prev, [platform]: "" }));
  }

  const canProceed = useCallback(() => {
    if (step === 1) return !!selectedProduct;
    if (step === 2) return selectedPlatforms.length > 0;
    if (step === 3) return true;
    if (step === 4) return selectedPlatforms.some((p) => content[p].caption.length > 0);
    return true;
  }, [step, selectedProduct, selectedPlatforms, content]);

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-navy">✍️ Compose Post</h1>
        <p className="text-navy/60 mt-1">
          Create AI-powered social content for your products.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0 mb-8 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <div key={s.n} className="flex items-center flex-shrink-0">
            <button
              onClick={() => {
                if (s.n < step) setStep(s.n as Step);
              }}
              disabled={s.n > step}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all",
                s.n === step
                  ? "bg-navy text-gold"
                  : s.n < step
                  ? "text-navy/60 hover:text-navy hover:bg-cream-dark cursor-pointer"
                  : "text-navy/30 cursor-not-allowed"
              )}
            >
              <span
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                  s.n === step
                    ? "bg-gold text-navy"
                    : s.n < step
                    ? "bg-green-500 text-white"
                    : "bg-cream-dark text-navy/40"
                )}
              >
                {s.n < step ? <Check className="w-3 h-3" strokeWidth={3} /> : s.n}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <ChevronRight className="w-4 h-4 text-navy/20 flex-shrink-0 mx-1" />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Select Product */}
      {step === 1 && (
        <div>
          <h2 className="text-xl font-bold text-navy mb-4">Select a Product</h2>
          {productsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="card p-0 overflow-hidden animate-pulse">
                  <div className="aspect-square bg-cream-dark" />
                  <div className="p-3 space-y-2">
                    <div className="h-4 bg-cream-dark rounded w-3/4" />
                    <div className="h-4 bg-cream-dark rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : !products || products.length === 0 ? (
            <div className="card p-12 text-center">
              <Package className="w-12 h-12 text-navy/20 mx-auto mb-4" />
              <p className="font-bold text-navy">No products found</p>
              <p className="text-sm text-navy/50 mt-1">
                Sync your Shopify store to import products.
              </p>
              <button
                onClick={() => api.syncShopify().then(() => toast("success", "Synced!"))}
                className="btn-primary mt-4"
              >
                Sync Shopify
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((product) => (
                <button
                  key={product.id}
                  onClick={() => setSelectedProduct(product)}
                  className={cn(
                    "card p-0 overflow-hidden text-left transition-all duration-200 hover:shadow-md hover:-translate-y-0.5",
                    selectedProduct?.id === product.id
                      ? "ring-2 ring-gold ring-offset-2 shadow-lg"
                      : ""
                  )}
                >
                  <div className="aspect-square bg-cream-dark relative">
                    {product.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.image_url}
                        alt={product.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-4xl">🍺</span>
                      </div>
                    )}
                    {selectedProduct?.id === product.id && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-gold rounded-full flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-navy" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-navy leading-tight line-clamp-2">
                      {product.title}
                    </p>
                    <p className="text-sm font-bold text-gold mt-1">${product.price}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Select Platforms */}
      {step === 2 && (
        <div>
          <h2 className="text-xl font-bold text-navy mb-2">Select Platforms</h2>
          <p className="text-navy/60 mb-6">
            Choose where you want to publish. Content will be tailored for each platform.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
            {PLATFORMS.map((p) => {
              const active = selectedPlatforms.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => togglePlatform(p.id)}
                  className={cn(
                    "card p-5 text-left transition-all duration-200 hover:shadow-md hover:-translate-y-0.5",
                    active ? "ring-2 ring-gold ring-offset-2 bg-gold/5" : ""
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-3xl">{p.icon}</span>
                    <div
                      className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                        active ? "border-gold bg-gold" : "border-cream-dark"
                      )}
                    >
                      {active && <Check className="w-3 h-3 text-navy" strokeWidth={3} />}
                    </div>
                  </div>
                  <p className="font-bold text-navy">{p.label}</p>
                  <p className="text-xs text-navy/50 mt-1">{p.desc}</p>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-navy/40 mt-4">
            {selectedPlatforms.length === 0
              ? "Select at least one platform"
              : `${selectedPlatforms.length} platform${selectedPlatforms.length > 1 ? "s" : ""} selected`}
          </p>
        </div>
      )}

      {/* Step 3: Generate with AI */}
      {step === 3 && (
        <div className="max-w-2xl">
          <h2 className="text-xl font-bold text-navy mb-2">Generate with AI</h2>
          <p className="text-navy/60 mb-6">
            Our AI agent will craft platform-specific captions and hashtags for your product.
          </p>

          {/* Selected product summary */}
          {selectedProduct && (
            <div className="card p-4 mb-6 flex items-center gap-4">
              <div className="w-14 h-14 rounded-lg bg-cream-dark overflow-hidden flex-shrink-0">
                {selectedProduct.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedProduct.image_url}
                    alt={selectedProduct.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-2xl">🍺</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-navy truncate">{selectedProduct.title}</p>
                <p className="text-sm text-gold font-semibold">${selectedProduct.price}</p>
                <div className="flex gap-2 mt-1">
                  {selectedPlatforms.map((p) => (
                    <PlatformBadge key={p} platform={p} size="sm" />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tone notes */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-navy mb-2">
              Tone Notes{" "}
              <span className="font-normal text-navy/40">(optional)</span>
            </label>
            <textarea
              value={toneNotes}
              onChange={(e) => setToneNotes(e.target.value)}
              placeholder="e.g. Emphasize vintage nostalgia, use casual American slang, mention the limited edition aspect..."
              className="w-full h-24 px-4 py-3 rounded-xl border border-cream-dark bg-white text-navy text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold placeholder:text-navy/30"
            />
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn-primary text-base px-6 py-3"
          >
            {generating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
            {generating ? "Generating..." : "Generate Content"}
          </button>

          {/* Stream progress */}
          {(generating || streamMessages.length > 0) && (
            <div className="mt-6 card p-5 bg-navy/3">
              <div className="flex items-center gap-2 mb-3">
                <div
                  className={cn(
                    "w-2 h-2 rounded-full bg-gold",
                    generating ? "animate-pulse" : ""
                  )}
                />
                <p className="text-sm font-semibold text-navy">
                  {generating ? "AI Agent Working..." : "Generation Complete"}
                </p>
              </div>
              <div className="space-y-1.5">
                {streamMessages.map((msg, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-gold text-xs mt-0.5 flex-shrink-0">▸</span>
                    <p className="text-sm text-navy/70">{msg}</p>
                  </div>
                ))}
                {generating && (
                  <div className="flex items-center gap-1.5 text-navy/40 pl-4 pt-1">
                    <div className="dot-pulse">
                      <span /><span /><span />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 4: Review & Edit */}
      {step === 4 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-navy">Review & Edit</h2>
            <button
              onClick={() => setPreviewMode(!previewMode)}
              className="btn-ghost text-sm"
            >
              <Eye className="w-4 h-4" />
              {previewMode ? "Edit Mode" : "Preview Mode"}
            </button>
          </div>

          {/* Platform tabs */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {selectedPlatforms.map((p) => (
              <button
                key={p}
                onClick={() => setActiveTab(p)}
                className={cn(
                  "platform-tab",
                  activeTab === p ? "platform-tab-active" : "platform-tab-inactive"
                )}
              >
                <PlatformBadge platform={p} size="sm" showLabel={true} />
              </button>
            ))}
          </div>

          <div className={cn("grid gap-8", previewMode ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
            {/* Editor */}
            {!previewMode || true ? (
              <div className={cn("space-y-5", previewMode ? "" : "max-w-2xl")}>
                {/* Caption */}
                <div>
                  <label className="block text-sm font-semibold text-navy mb-2">Caption</label>
                  <textarea
                    value={content[activeTab].caption}
                    onChange={(e) =>
                      setContent((prev) => ({
                        ...prev,
                        [activeTab]: { ...prev[activeTab], caption: e.target.value },
                      }))
                    }
                    placeholder={`Write your ${activeTab} caption...`}
                    rows={activeTab === "tiktok" ? 3 : 5}
                    className="w-full px-4 py-3 rounded-xl border border-cream-dark bg-white text-navy text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold placeholder:text-navy/30 leading-relaxed"
                  />
                  <p className="text-xs text-navy/40 mt-1 text-right">
                    {content[activeTab].caption.length} chars
                  </p>
                </div>

                {/* Hashtags */}
                <div>
                  <label className="block text-sm font-semibold text-navy mb-2">Hashtags</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {content[activeTab].hashtags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => removeHashtag(activeTab, tag)}
                        className="hashtag-chip group"
                        title="Click to remove"
                      >
                        #{tag}
                        <X className="w-3 h-3 text-navy/40 group-hover:text-red transition-colors" />
                      </button>
                    ))}
                    {content[activeTab].hashtags.length === 0 && (
                      <p className="text-sm text-navy/40">No hashtags added yet</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newHashtag[activeTab]}
                      onChange={(e) =>
                        setNewHashtag((prev) => ({ ...prev, [activeTab]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          addHashtag(activeTab);
                        }
                      }}
                      placeholder="Add hashtag..."
                      className="flex-1 px-3 py-2 rounded-lg border border-cream-dark bg-white text-navy text-sm focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold placeholder:text-navy/30"
                    />
                    <button
                      onClick={() => addHashtag(activeTab)}
                      className="btn-secondary py-2 px-3 text-sm"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-navy/40 mt-1">
                    {content[activeTab].hashtags.length} hashtags · Press Enter or comma to add
                  </p>
                </div>

                {/* Media upload */}
                <div>
                  <label className="block text-sm font-semibold text-navy mb-2">Media</label>
                  <MediaUpload
                    onChange={setUploadedFiles}
                    maxFiles={5}
                  />
                  {uploadedFiles.length > 0 && (
                    <p className="text-xs text-navy/40 mt-1">
                      {uploadedFiles.length} file{uploadedFiles.length > 1 ? "s" : ""} attached
                    </p>
                  )}
                </div>
              </div>
            ) : null}

            {/* Preview panel */}
            {previewMode && (
              <div>
                <p className="text-sm font-semibold text-navy/50 mb-3 uppercase tracking-wider">
                  Preview
                </p>
                <PostPreview
                  platform={activeTab}
                  caption={content[activeTab].caption}
                  hashtags={content[activeTab].hashtags}
                />
              </div>
            )}
          </div>

          {/* Regenerate button */}
          <button
            onClick={() => {
              setStep(3);
              setStreamMessages([]);
            }}
            className="btn-ghost mt-4 text-sm"
          >
            <Sparkles className="w-4 h-4" />
            Regenerate Content
          </button>
        </div>
      )}

      {/* Step 5: Schedule/Publish */}
      {step === 5 && (
        <div className="max-w-2xl">
          <h2 className="text-xl font-bold text-navy mb-2">Publish</h2>
          <p className="text-navy/60 mb-6">
            Choose when to publish your content to the selected platforms.
          </p>

          {/* Summary */}
          <div className="card p-5 mb-6">
            <p className="text-sm font-semibold text-navy mb-3">Summary</p>
            <div className="space-y-3">
              {selectedPlatforms.map((p) => (
                <div key={p} className="flex items-start gap-3">
                  <PlatformBadge platform={p} size="sm" showLabel={false} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-navy line-clamp-2">
                      {content[p].caption || "No caption"}
                    </p>
                    <p className="text-xs text-navy/40 mt-0.5">
                      {content[p].hashtags.length} hashtags
                    </p>
                  </div>
                  {publishedPlatforms.includes(p) ? (
                    <span className="flex-shrink-0 badge-published">
                      <Check className="w-3 h-3" /> Done
                    </span>
                  ) : (
                    <button
                      onClick={() => handlePublish(p)}
                      disabled={publishing !== null}
                      className="flex-shrink-0 btn-primary py-1.5 px-3 text-xs"
                    >
                      {publishing === p ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      Publish
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Publish all */}
          {publishedPlatforms.length < selectedPlatforms.length && (
            <button
              onClick={() => handlePublish("all")}
              disabled={publishing !== null}
              className="btn-primary text-base px-6 py-3 mb-4"
            >
              {publishing === "all" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
              Publish to All Platforms
            </button>
          )}

          {/* Save as draft */}
          <div>
            <button onClick={handleSaveDraft} className="btn-ghost text-sm">
              Save as Draft
            </button>
          </div>

          {/* Schedule - Coming Soon */}
          <div className="card p-5 mt-6 border-dashed">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cream-dark flex items-center justify-center">
                <span className="text-xl">🗓️</span>
              </div>
              <div>
                <p className="font-bold text-navy text-sm">Scheduled Publishing</p>
                <p className="text-xs text-navy/50 mt-0.5">
                  Coming soon — schedule posts for optimal engagement times
                </p>
              </div>
              <span className="ml-auto badge-scheduled">Coming Soon</span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-10 pt-6 border-t border-cream-dark">
        <button
          onClick={() => setStep((s) => Math.max(1, s - 1) as Step)}
          disabled={step === 1}
          className="btn-ghost disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        {step < 5 ? (
          <button
            onClick={() => setStep((s) => Math.min(5, s + 1) as Step)}
            disabled={!canProceed()}
            className="btn-primary disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {step === 4 ? "Continue to Publish" : "Next"}
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
