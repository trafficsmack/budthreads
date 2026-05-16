"use client";

import { useState } from "react";
import {
  Users,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Loader2,
  Copy,
  Search,
} from "lucide-react";
import { streamAgentResponse, AgentStreamEvent } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "@/components/Toaster";

type Platform = "instagram" | "facebook" | "tiktok";
type Niche = "americana" | "beer_brewing" | "vintage_retro" | "patriotic" | "fashion";

interface Influencer {
  name: string;
  handle: string;
  platform?: Platform;
  estimated_followers?: string;
  niche_tags?: string[];
  bio?: string;
  engagement_rate?: string;
  profile_url?: string;
}

interface SimilarBrand {
  name: string;
  handle?: string;
  description?: string;
  platform?: Platform;
}

interface OutreachTemplate {
  subject?: string;
  body: string;
  type?: string;
}

interface InfluencerResults {
  influencers?: Influencer[];
  similar_brands?: SimilarBrand[];
  outreach_templates?: OutreachTemplate[];
  raw_insights?: string[];
}

const PLATFORMS: { id: Platform; label: string; icon: string }[] = [
  { id: "instagram", label: "Instagram", icon: "📸" },
  { id: "facebook", label: "Facebook", icon: "👥" },
  { id: "tiktok", label: "TikTok", icon: "🎵" },
];

const NICHES: { id: Niche; label: string; icon: string }[] = [
  { id: "americana", label: "Americana", icon: "🇺🇸" },
  { id: "beer_brewing", label: "Beer/Brewing", icon: "🍺" },
  { id: "vintage_retro", label: "Vintage/Retro", icon: "📻" },
  { id: "patriotic", label: "Patriotic", icon: "⭐" },
  { id: "fashion", label: "Fashion", icon: "👕" },
];

const NICHE_LABELS: Record<Niche, string> = {
  americana: "Americana",
  beer_brewing: "Beer/Brewing",
  vintage_retro: "Vintage/Retro",
  patriotic: "Patriotic",
  fashion: "Fashion",
};

function InfluencerCard({ influencer }: { influencer: Influencer }) {
  return (
    <div className="card p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-navy to-navy-light flex items-center justify-center flex-shrink-0 text-gold font-black text-xl">
          {influencer.name?.charAt(0).toUpperCase() ?? "?"}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <p className="font-bold text-navy">{influencer.name}</p>
              <p className="text-sm text-navy/50">{influencer.handle}</p>
            </div>
            {influencer.profile_url ? (
              <a
                href={influencer.profile_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost text-xs py-1.5 px-3 flex-shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View Profile
              </a>
            ) : (
              <button className="btn-ghost text-xs py-1.5 px-3 flex-shrink-0">
                <Search className="w-3.5 h-3.5" />
                Find Profile
              </button>
            )}
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-3 mt-2">
            {influencer.estimated_followers && (
              <div className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-navy/40" />
                <span className="text-sm font-semibold text-navy">
                  {influencer.estimated_followers}
                </span>
                <span className="text-xs text-navy/40">followers</span>
              </div>
            )}
            {influencer.engagement_rate && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-green-600 font-semibold bg-green-50 px-2 py-0.5 rounded-full">
                  {influencer.engagement_rate} eng.
                </span>
              </div>
            )}
          </div>

          {/* Bio */}
          {influencer.bio && (
            <p className="text-sm text-navy/60 mt-2 leading-relaxed line-clamp-2">
              {influencer.bio}
            </p>
          )}

          {/* Niche tags */}
          {influencer.niche_tags && influencer.niche_tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {influencer.niche_tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs font-medium text-gold bg-gold/10 px-2 py-0.5 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OutreachTemplateCard({ template, index }: { template: OutreachTemplate; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const text = template.subject
      ? `Subject: ${template.subject}\n\n${template.body}`
      : template.body;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast("success", "Template Copied!", "Paste it into your DM or email.");
  }

  return (
    <div className="card p-0 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-cream/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gold/20 flex items-center justify-center font-bold text-sm text-gold">
            {index + 1}
          </div>
          <div className="text-left">
            <p className="font-semibold text-navy text-sm">
              {template.type ?? `Outreach Template ${index + 1}`}
            </p>
            {template.subject && (
              <p className="text-xs text-navy/50 mt-0.5">Subject: {template.subject}</p>
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-navy/40 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-navy/40 flex-shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-cream-dark">
          <div className="bg-cream/50 rounded-xl p-4 mt-3">
            <pre className="text-sm text-navy/80 whitespace-pre-wrap font-sans leading-relaxed">
              {template.body}
            </pre>
          </div>
          <button onClick={handleCopy} className="btn-ghost text-sm mt-3">
            {copied ? (
              <>
                <span className="text-green-500">✓</span> Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy Template
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export default function InfluencersPage() {
  const [activePlatform, setActivePlatform] = useState<Platform>("instagram");
  const [selectedNiches, setSelectedNiches] = useState<Niche[]>(["americana", "beer_brewing"]);
  const [discovering, setDiscovering] = useState(false);
  const [streamMessages, setStreamMessages] = useState<string[]>([]);
  const [results, setResults] = useState<InfluencerResults | null>(null);

  function toggleNiche(niche: Niche) {
    setSelectedNiches((prev) =>
      prev.includes(niche)
        ? prev.length > 1
          ? prev.filter((n) => n !== niche)
          : prev
        : [...prev, niche]
    );
  }

  async function handleDiscover() {
    setDiscovering(true);
    setResults(null);
    setStreamMessages([]);

    try {
      const stream = streamAgentResponse("/api/agents/discover-influencers", {
        platform: activePlatform,
        niches: selectedNiches,
      });

      const accumulated: InfluencerResults = {};

      for await (const event of stream) {
        const e = event as AgentStreamEvent;

        if (e.type === "progress" && e.message) {
          setStreamMessages((prev) => [...prev, e.message!]);
        }

        if (e.type === "result" && e.data) {
          const data = e.data as InfluencerResults;
          if (data.influencers) {
            accumulated.influencers = [...(accumulated.influencers ?? []), ...data.influencers];
          }
          if (data.similar_brands) {
            accumulated.similar_brands = [...(accumulated.similar_brands ?? []), ...data.similar_brands];
          }
          if (data.outreach_templates) {
            accumulated.outreach_templates = [...(accumulated.outreach_templates ?? []), ...data.outreach_templates];
          }
          if (data.raw_insights) {
            accumulated.raw_insights = [...(accumulated.raw_insights ?? []), ...data.raw_insights];
          }
          setResults({ ...accumulated });
        }

        if (e.type === "done") {
          setResults({ ...accumulated });
          toast("success", "Discovery Complete", `Found ${accumulated.influencers?.length ?? 0} influencers.`);
        }

        if (e.type === "error") {
          toast("error", "Discovery Failed", e.message);
          break;
        }
      }
    } catch {
      toast("error", "Connection Error", "Could not reach the discovery agent.");

      // Demo data
      setResults({
        influencers: [
          {
            name: "Americana Collectibles",
            handle: "@americana_collectibles",
            estimated_followers: "48.2K",
            niche_tags: ["Americana", "Vintage", "Beer Culture"],
            engagement_rate: "4.2%",
            bio: "Curating the best in American nostalgia — vintage signs, breweriana, and classic Americana gear.",
          },
          {
            name: "Bud History Vault",
            handle: "@budhistoryvault",
            estimated_followers: "31.8K",
            niche_tags: ["Beer History", "Budweiser", "Collectibles"],
            engagement_rate: "6.1%",
            bio: "Documenting the rich history of American brewing culture, one artifact at a time.",
          },
          {
            name: "Patriot Threads Co",
            handle: "@patriotthreadsco",
            estimated_followers: "89.4K",
            niche_tags: ["Patriotic Fashion", "Americana", "Vintage"],
            engagement_rate: "3.8%",
            bio: "American-made apparel celebrating our heritage. Built different.",
          },
          {
            name: "Retro Brew Reviews",
            handle: "@retrobrewreviews",
            estimated_followers: "22.6K",
            niche_tags: ["Beer Review", "Retro", "Americana"],
            engagement_rate: "7.3%",
            bio: "Reviewing the classics so you don't have to. Old school taste, modern takes.",
          },
          {
            name: "Classic USA Gear",
            handle: "@classicusagear",
            estimated_followers: "156K",
            niche_tags: ["Fashion", "Americana", "Lifestyle"],
            engagement_rate: "2.9%",
            bio: "Your source for authentic American style. We don't chase trends — we set them.",
          },
          {
            name: "Breweriana Collector",
            handle: "@breweriana_hq",
            estimated_followers: "41.3K",
            niche_tags: ["Beer Collectibles", "Vintage", "Beer Culture"],
            engagement_rate: "5.4%",
            bio: "The largest community for brewery memorabilia collectors. Buy, sell, trade.",
          },
        ],
        similar_brands: [
          {
            name: "Grunt Style",
            handle: "@gruntstyle",
            description: "Military-inspired Americana apparel with massive following in similar demographics.",
          },
          {
            name: "Howler Brothers",
            handle: "@howlerbros",
            description: "Outdoor lifestyle brand with strong Americana aesthetic and dedicated fan base.",
          },
          {
            name: "American Rowdy",
            handle: "@americanrowdy",
            description: "Beer-forward lifestyle brand targeting the same patriotic, fun-loving audience.",
          },
        ],
        outreach_templates: [
          {
            type: "Instagram DM — Collab Pitch",
            subject: undefined,
            body: `Hey [Name]! 👋

Love your content — your posts really capture that authentic American spirit we're all about.

I'm reaching out from Vintage Bud Threads — we create retro-inspired gear featuring the classic Bud Man character. We think your audience would genuinely love our stuff.

Would you be open to a collab? We'd send you some pieces to style however feels authentic to you, no scripts — just real content from a real fan.

No pressure at all, but if you're curious, here's our shop: vintagebudthreads.com

Cheers! 🍺`,
          },
          {
            type: "Email — Brand Partnership",
            subject: "Brand Partnership — Vintage Bud Threads x [Name]",
            body: `Hi [Name],

I've been following your work for a while and I think there's a great alignment between your audience and our brand.

Vintage Bud Threads creates premium retro gear celebrating the iconic Bud Man character from vintage Budweiser advertising. Our community loves Americana, nostalgia, and authentic American culture — which matches your audience perfectly.

I'd love to explore a potential partnership. We're open to:
• Gifting program (no strings attached)
• Paid collaboration posts
• Affiliate arrangement
• Long-term ambassador role

Would a 15-minute call work this week? I'd love to hear more about what partnerships look like on your end.

Best,
[Your Name]
Vintage Bud Threads
vintagebudthreads.com`,
          },
          {
            type: "TikTok Comment → DM Funnel",
            subject: undefined,
            body: `Commenting on relevant post: "This is exactly our vibe 🍺🇺🇸 — do you know Vintage Bud Threads? Think you'd love it"

Follow-up DM after engagement:
"Hey! Saw you liked our comment — figured I'd reach out directly. We make retro Bud Man gear and I think your audience would love it. Want us to send you a few pieces?"`,
          },
        ],
      });
    } finally {
      setDiscovering(false);
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-navy">👥 Influencer Discovery</h1>
        <p className="text-navy/60 mt-1">
          Find the right partners to amplify your brand.
        </p>
      </div>

      {/* Filters card */}
      <div className="card p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Platform */}
          <div>
            <p className="text-sm font-semibold text-navy mb-3">Platform</p>
            <div className="flex gap-2 flex-wrap">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setActivePlatform(p.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all",
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
          </div>

          {/* Niches */}
          <div>
            <p className="text-sm font-semibold text-navy mb-3">Niches</p>
            <div className="flex gap-2 flex-wrap">
              {NICHES.map((n) => {
                const active = selectedNiches.includes(n.id);
                return (
                  <button
                    key={n.id}
                    onClick={() => toggleNiche(n.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 text-xs font-semibold transition-all",
                      active
                        ? "border-gold bg-gold/10 text-navy"
                        : "border-cream-dark text-navy/50 hover:border-navy/20 hover:text-navy"
                    )}
                  >
                    <span>{n.icon}</span>
                    <span>{n.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-navy/40 mt-2">
              {selectedNiches.map((n) => NICHE_LABELS[n]).join(", ")}
            </p>
          </div>
        </div>

        <div className="mt-5 pt-5 border-t border-cream-dark">
          <button
            onClick={handleDiscover}
            disabled={discovering}
            className="btn-primary px-6 py-2.5"
          >
            {discovering ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Users className="w-4 h-4" />
            )}
            {discovering ? "Discovering..." : "Find Influencers"}
          </button>
        </div>
      </div>

      {/* Streaming progress */}
      {(discovering || streamMessages.length > 0) && !results && (
        <div className="card p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className={cn("w-2 h-2 rounded-full bg-gold", discovering ? "animate-pulse" : "")} />
            <p className="text-sm font-semibold text-navy">
              {discovering ? "Agent Searching..." : "Search Complete"}
            </p>
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-thin">
            {streamMessages.map((msg, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-gold text-xs mt-0.5 flex-shrink-0">▸</span>
                <p className="text-sm text-navy/70">{msg}</p>
              </div>
            ))}
            {discovering && (
              <div className="flex items-center gap-1.5 text-navy/40 pl-4 pt-1 dot-pulse">
                <span /><span /><span />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-8">
          {/* Influencers */}
          {results.influencers && results.influencers.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-navy">
                  Influencers
                  <span className="ml-2 text-sm font-normal text-navy/50">
                    ({results.influencers.length} found)
                  </span>
                </h2>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {results.influencers.map((influencer, i) => (
                  <InfluencerCard key={i} influencer={influencer} />
                ))}
              </div>
            </div>
          )}

          {/* Similar Brands */}
          {results.similar_brands && results.similar_brands.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-navy mb-4">Similar Brands</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {results.similar_brands.map((brand, i) => (
                  <div key={i} className="card p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-cream-dark flex items-center justify-center font-black text-lg text-navy/40">
                        {brand.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-navy text-sm">{brand.name}</p>
                        {brand.handle && (
                          <p className="text-xs text-navy/50">{brand.handle}</p>
                        )}
                      </div>
                    </div>
                    {brand.description && (
                      <p className="text-xs text-navy/60 leading-relaxed">{brand.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Outreach Templates */}
          {results.outreach_templates && results.outreach_templates.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-navy mb-4">Outreach Templates</h2>
              <p className="text-sm text-navy/60 mb-4">
                Customize these templates to reach out to influencers. Click to expand and copy.
              </p>
              <div className="space-y-3">
                {results.outreach_templates.map((template, i) => (
                  <OutreachTemplateCard key={i} template={template} index={i} />
                ))}
              </div>
            </div>
          )}

          {/* Raw insights */}
          {results.raw_insights && results.raw_insights.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-navy mb-4">Additional Insights</h2>
              <div className="card p-5 space-y-2">
                {results.raw_insights.map((insight, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-navy/30 text-xs mt-1">▸</span>
                    <p className="text-sm text-navy/70 leading-relaxed">{insight}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!results && !discovering && streamMessages.length === 0 && (
        <div className="card p-16 text-center">
          <div className="w-20 h-20 bg-cream-dark rounded-full flex items-center justify-center mx-auto mb-6">
            <Users className="w-10 h-10 text-navy/20" />
          </div>
          <p className="font-bold text-navy text-lg">Find Your Perfect Partners</p>
          <p className="text-navy/50 text-sm mt-2 max-w-sm mx-auto">
            Select a platform and niches above, then click &quot;Find Influencers&quot; to
            discover creators who align with the Vintage Bud Threads brand.
          </p>
        </div>
      )}
    </div>
  );
}
