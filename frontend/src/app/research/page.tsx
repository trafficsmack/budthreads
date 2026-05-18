"use client";

import { useState, useEffect } from "react";
import {
  TrendingUp,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Calendar,
  Hash,
} from "lucide-react";
import { streamAgentResponse, AgentStreamEvent } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "@/components/Toaster";

type Platform = "instagram" | "facebook" | "tiktok";

interface HashtagResult {
  tag: string;
  estimated_reach?: string;
  category?: string;
}

interface ContentTrend {
  title: string;
  description?: string;
  format?: string;
}

interface UpcomingDate {
  date: string;
  name: string;
  relevance?: string;
}

interface ContentTip {
  tip: string;
  example?: string;
}

interface TrendResults {
  hashtags?: HashtagResult[];
  content_trends?: ContentTrend[];
  upcoming_dates?: UpcomingDate[];
  content_tips?: ContentTip[];
  raw_insights?: string[];
}

const PLATFORMS: { id: Platform; label: string; icon: string; desc: string }[] = [
  { id: "instagram", label: "Instagram", icon: "📸", desc: "Visual storytelling & hashtags" },
  { id: "facebook", label: "Facebook", icon: "👥", desc: "Community & engagement" },
  { id: "tiktok", label: "TikTok", icon: "🎵", desc: "Viral trends & sounds" },
];

function HashtagChip({
  tag,
  reach,
  onCopy,
}: {
  tag: string;
  reach?: string;
  onCopy: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(`#${tag}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopy();
  }

  return (
    <button
      onClick={handleCopy}
      className="group inline-flex flex-col items-start gap-0.5 px-3 py-2 rounded-xl bg-navy/5 hover:bg-navy/10 border border-transparent hover:border-navy/10 transition-all text-left"
      title={`Copy #${tag}`}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-semibold text-navy">#{tag}</span>
        {copied ? (
          <Check className="w-3 h-3 text-green-500" strokeWidth={3} />
        ) : (
          <Copy className="w-3 h-3 text-navy/30 group-hover:text-navy/60 transition-colors" />
        )}
      </div>
      {reach && <span className="text-xs text-navy/40">{reach}</span>}
    </button>
  );
}

function Section({
  title,
  icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="card p-0 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-cream/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-navy/5 flex items-center justify-center">
            {icon}
          </div>
          <span className="font-bold text-navy">{title}</span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-navy/40" />
        ) : (
          <ChevronDown className="w-4 h-4 text-navy/40" />
        )}
      </button>
      {open && <div className="px-5 pb-5 border-t border-cream-dark">{children}</div>}
    </div>
  );
}

export default function ResearchPage() {
  const [activePlatform, setActivePlatform] = useState<Platform>("instagram");

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    console.log("[Research] API URL:", apiUrl);
    fetch(`${apiUrl}/health`)
      .then(r => r.json())
      .then(d => console.log("[Research] /health OK:", d))
      .catch(e => console.error("[Research] /health FAILED:", e.message));
  }, []);
  const [researching, setResearching] = useState(false);
  const [streamMessages, setStreamMessages] = useState<string[]>([]);
  const [results, setResults] = useState<TrendResults | null>(null);
  const [copiedSets, setCopiedSets] = useState<Set<string>>(new Set());

  async function handleResearch() {
    setResearching(true);
    setResults(null);
    setStreamMessages([]);

    try {
      const stream = streamAgentResponse(
        `/api/agents/research-trends?platform=${activePlatform}`
      );

      const accumulated: TrendResults = {};

      for await (const event of stream) {
        const e = event as AgentStreamEvent;

        if (e.type === "progress" && e.message) {
          setStreamMessages((prev) => [...prev, e.message!]);
        }

        if (e.type === "result" && e.data) {
          const data = e.data as TrendResults;

          if (data.hashtags) {
            accumulated.hashtags = [
              ...(accumulated.hashtags ?? []),
              ...data.hashtags,
            ];
          }
          if (data.content_trends) {
            accumulated.content_trends = [
              ...(accumulated.content_trends ?? []),
              ...data.content_trends,
            ];
          }
          if (data.upcoming_dates) {
            accumulated.upcoming_dates = [
              ...(accumulated.upcoming_dates ?? []),
              ...data.upcoming_dates,
            ];
          }
          if (data.content_tips) {
            accumulated.content_tips = [
              ...(accumulated.content_tips ?? []),
              ...data.content_tips,
            ];
          }
          if (data.raw_insights) {
            accumulated.raw_insights = [
              ...(accumulated.raw_insights ?? []),
              ...data.raw_insights,
            ];
          }

          setResults({ ...accumulated });
        }

        if (e.type === "done") {
          setResults({ ...accumulated });
          toast("success", "Research Complete", `Found ${accumulated.hashtags?.length ?? 0} hashtags and trends for ${activePlatform}.`);
        }

        if (e.type === "error") {
          toast("error", "Research Failed", e.message);
          break;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Research] connection error:", msg);
      toast("error", "Connection Error", msg);

      // Demo data for when API is unavailable
      setResults({
        hashtags: [
          { tag: "VintageBeer", estimated_reach: "2.4M posts", category: "Brand" },
          { tag: "BudMan", estimated_reach: "890K posts", category: "Character" },
          { tag: "AmericanaBeer", estimated_reach: "1.2M posts", category: "Lifestyle" },
          { tag: "RetroBrewery", estimated_reach: "340K posts", category: "Vintage" },
          { tag: "BudweiserVintage", estimated_reach: "780K posts", category: "Brand" },
          { tag: "ClassicAmericana", estimated_reach: "5.6M posts", category: "Lifestyle" },
          { tag: "VintageThreads", estimated_reach: "2.1M posts", category: "Fashion" },
          { tag: "BeerMerch", estimated_reach: "430K posts", category: "Shopping" },
          { tag: "PatrioticStyle", estimated_reach: "3.2M posts", category: "Lifestyle" },
          { tag: "BrewingCulture", estimated_reach: "1.8M posts", category: "Beer" },
        ],
        content_trends: [
          { title: "Nostalgia Unboxing Videos", description: "Show the product arriving in branded packaging — retro aesthetic gets huge engagement.", format: "Reel / TikTok" },
          { title: "'Then vs Now' Americana Comparisons", description: "Side-by-side of vintage Bud Man ads with your modern merch. Highly shareable.", format: "Carousel" },
          { title: "Backyard BBQ Lifestyle Shots", description: "Products styled in authentic American settings with natural lighting.", format: "Photo" },
          { title: "Storytelling Captions", description: "Long-form captions about the history of Bud Man connect with brand enthusiasts.", format: "Story" },
        ],
        upcoming_dates: [
          { date: "2026-05-25", name: "Memorial Day", relevance: "Peak patriotic content — highest engagement window of the month" },
          { date: "2026-06-14", name: "Flag Day", relevance: "Perfect for Americana-themed product showcases" },
          { date: "2026-07-04", name: "Independence Day", relevance: "Biggest opportunity of the summer — plan 2 weeks ahead" },
          { date: "2026-09-07", name: "Labor Day", relevance: "End-of-summer beer season content" },
        ],
        content_tips: [
          { tip: "Post between 11am–1pm and 7pm–9pm EST for highest engagement on weekdays." },
          { tip: "Use 8–15 hashtags on Instagram for optimal reach without looking spammy." },
          { tip: "Authentic lifestyle photography outperforms studio shots 3:1 for apparel brands." },
          { tip: "User-generated content reposts drive 28% more engagement than original posts." },
        ],
      });
    } finally {
      setResearching(false);
    }
  }

  function copyAllHashtags() {
    if (!results?.hashtags) return;
    const text = results.hashtags.map((h) => `#${h.tag}`).join(" ");
    navigator.clipboard.writeText(text);
    toast("success", "Copied!", `${results.hashtags.length} hashtags copied to clipboard.`);
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-navy">📈 Trend Research</h1>
        <p className="text-navy/60 mt-1">
          Hashtag intelligence & content trends for your next campaign.
        </p>
      </div>

      {/* Platform tabs + Research button */}
      <div className="card p-5 mb-6">
        <p className="text-sm font-semibold text-navy/60 mb-3">Select Platform</p>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex gap-2 flex-wrap flex-1">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => setActivePlatform(p.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all",
                  activePlatform === p.id
                    ? "border-navy bg-navy text-cream"
                    : "border-cream-dark text-navy/60 hover:border-navy/30 hover:text-navy"
                )}
              >
                <span>{p.icon}</span>
                <span>{p.label}</span>
              </button>
            ))}
          </div>

          <button
            onClick={handleResearch}
            disabled={researching}
            className="btn-primary px-5 py-2.5 text-sm flex-shrink-0"
          >
            {researching ? (
              <>
                <span className="inline-flex gap-1 dot-pulse">
                  <span className="w-1.5 h-1.5 bg-navy" />
                  <span className="w-1.5 h-1.5 bg-navy" />
                  <span className="w-1.5 h-1.5 bg-navy" />
                </span>
                Researching...
              </>
            ) : (
              <>
                <TrendingUp className="w-4 h-4" />
                Research Now
              </>
            )}
          </button>
        </div>
      </div>

      {/* Streaming progress */}
      {(researching || streamMessages.length > 0) && (
        <div className="card p-5 mb-6 bg-navy/2">
          <div className="flex items-center gap-2 mb-3">
            <div className={cn("w-2 h-2 rounded-full bg-gold", researching ? "animate-pulse" : "")} />
            <p className="text-sm font-semibold text-navy">
              {researching ? "Agent Researching..." : "Research Complete"}
            </p>
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-thin">
            {streamMessages.map((msg, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-gold text-xs mt-0.5 flex-shrink-0">▸</span>
                <p className="text-sm text-navy/70">{msg}</p>
              </div>
            ))}
            {researching && (
              <div className="flex items-center gap-1.5 text-navy/40 pl-4 pt-1 dot-pulse">
                <span /><span /><span />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-4">
          {/* Hashtags */}
          {results.hashtags && results.hashtags.length > 0 && (
            <Section
              title="Top Hashtags"
              icon={<Hash className="w-4 h-4 text-navy" />}
              defaultOpen={true}
            >
              <div className="pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-navy/60">
                    {results.hashtags.length} hashtags found · Click to copy individual tags
                  </p>
                  <button
                    onClick={copyAllHashtags}
                    className="btn-ghost text-xs py-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy All
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {results.hashtags.map((h) => (
                    <HashtagChip
                      key={h.tag}
                      tag={h.tag}
                      reach={h.estimated_reach}
                      onCopy={() => {
                        setCopiedSets((prev) => new Set(Array.from(prev).concat(h.tag)));
                        toast("info", `Copied #${h.tag}`);
                      }}
                    />
                  ))}
                </div>

                {/* Category groups */}
                {(() => {
                  const categories = Array.from(new Set(results.hashtags?.map((h) => h.category).filter(Boolean)));
                  if (categories.length < 2) return null;
                  return (
                    <div className="mt-4 pt-4 border-t border-cream-dark">
                      <p className="text-xs font-semibold text-navy/40 uppercase tracking-wider mb-3">By Category</p>
                      <div className="space-y-2">
                        {categories.map((cat) => {
                          const tags = results.hashtags?.filter((h) => h.category === cat) ?? [];
                          return (
                            <div key={cat} className="flex items-center gap-3">
                              <span className="text-xs font-semibold text-navy/50 w-20 flex-shrink-0">{cat}</span>
                              <div className="flex flex-wrap gap-1.5">
                                {tags.map((h) => (
                                  <button
                                    key={h.tag}
                                    onClick={() => {
                                      navigator.clipboard.writeText(`#${h.tag}`);
                                      toast("info", `Copied #${h.tag}`);
                                    }}
                                    className="text-xs bg-navy/5 text-navy/70 hover:bg-navy/10 px-2 py-0.5 rounded-full transition-colors"
                                  >
                                    #{h.tag}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </Section>
          )}

          {/* Content Trends */}
          {results.content_trends && results.content_trends.length > 0 && (
            <Section
              title="Content Trends"
              icon={<TrendingUp className="w-4 h-4 text-navy" />}
              defaultOpen={true}
            >
              <div className="pt-4 space-y-3">
                {results.content_trends.map((trend, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-4 rounded-xl bg-cream/50 border border-cream-dark"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gold/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-gold">{i + 1}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-navy text-sm">{trend.title}</p>
                      {trend.description && (
                        <p className="text-sm text-navy/60 mt-0.5 leading-relaxed">
                          {trend.description}
                        </p>
                      )}
                      {trend.format && (
                        <span className="inline-block mt-1.5 text-xs font-semibold text-navy/40 bg-navy/5 px-2 py-0.5 rounded-full">
                          {trend.format}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Upcoming Dates */}
          {results.upcoming_dates && results.upcoming_dates.length > 0 && (
            <Section
              title="Upcoming Dates"
              icon={<Calendar className="w-4 h-4 text-navy" />}
              defaultOpen={true}
            >
              <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {results.upcoming_dates.map((d, i) => {
                  const dateObj = new Date(d.date + "T12:00:00");
                  return (
                    <div
                      key={i}
                      className="p-4 rounded-xl border border-cream-dark bg-white hover:border-gold/30 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-xl bg-red/5 border border-red/10 flex flex-col items-center justify-center flex-shrink-0">
                          <p className="text-xs font-bold text-red/60 uppercase">
                            {dateObj.toLocaleDateString("en-US", { month: "short" })}
                          </p>
                          <p className="text-lg font-black text-red/80 leading-none">
                            {dateObj.getDate()}
                          </p>
                        </div>
                        <div>
                          <p className="font-bold text-navy text-sm">{d.name}</p>
                          {d.relevance && (
                            <p className="text-xs text-navy/50 mt-0.5 leading-relaxed">
                              {d.relevance}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Content Tips */}
          {results.content_tips && results.content_tips.length > 0 && (
            <Section
              title="Platform Tips"
              icon={<Lightbulb className="w-4 h-4 text-navy" />}
              defaultOpen={false}
            >
              <div className="pt-4 space-y-2">
                {results.content_tips.map((t, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-gold text-base flex-shrink-0 mt-0.5">💡</span>
                    <div>
                      <p className="text-sm text-navy leading-relaxed">{t.tip}</p>
                      {t.example && (
                        <p className="text-xs text-navy/50 mt-1 italic">{t.example}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Raw insights */}
          {results.raw_insights && results.raw_insights.length > 0 && (
            <Section
              title="Additional Insights"
              icon={<TrendingUp className="w-4 h-4 text-navy" />}
              defaultOpen={false}
            >
              <div className="pt-4 space-y-2">
                {results.raw_insights.map((insight, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-navy/30 text-xs mt-1 flex-shrink-0">▸</span>
                    <p className="text-sm text-navy/70 leading-relaxed">{insight}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}

      {/* Empty state */}
      {!results && !researching && streamMessages.length === 0 && (
        <div className="card p-16 text-center">
          <div className="w-20 h-20 bg-cream-dark rounded-full flex items-center justify-center mx-auto mb-6">
            <TrendingUp className="w-10 h-10 text-navy/20" />
          </div>
          <p className="font-bold text-navy text-lg">Ready to Research</p>
          <p className="text-navy/50 text-sm mt-2 max-w-sm mx-auto">
            Select a platform above and click &quot;Research Now&quot; to discover trending hashtags,
            content formats, and upcoming relevant dates.
          </p>
        </div>
      )}
    </div>
  );
}
