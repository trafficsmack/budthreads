"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import {
  PenLine,
  TrendingUp,
  Users,
  RefreshCw,
  Plus,
  Trash2,
  Send,
  BarChart3,
  FileText,
  Package,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { api, Post } from "@/lib/api";
import PlatformBadge from "@/components/PlatformBadge";
import { toast } from "@/components/Toaster";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="stat-card">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${color}`}>
        <Icon className="w-5 h-5" strokeWidth={2} />
      </div>
      <p className="text-2xl font-bold text-navy">{value ?? "—"}</p>
      <p className="text-sm text-navy/60">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: Post["status"] }) {
  const map = {
    published: (
      <span className="badge-published">
        <CheckCircle2 className="w-3 h-3" /> Published
      </span>
    ),
    scheduled: (
      <span className="badge-scheduled">
        <Clock className="w-3 h-3" /> Scheduled
      </span>
    ),
    draft: (
      <span className="badge-draft">
        <FileText className="w-3 h-3" /> Draft
      </span>
    ),
    failed: (
      <span className="badge-failed">
        <AlertCircle className="w-3 h-3" /> Failed
      </span>
    ),
  };
  return map[status] ?? null;
}

export default function DashboardPage() {
  const [syncingShopify, setSyncingShopify] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: stats, isLoading: statsLoading } = useSWR(
    `${API_URL}/api/stats`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const {
    data: posts,
    isLoading: postsLoading,
    mutate: mutatePosts,
  } = useSWR<Post[]>(`${API_URL}/api/posts?limit=10`, fetcher, {
    refreshInterval: 30000,
  });

  const {
    data: products,
    isLoading: productsLoading,
  } = useSWR(`${API_URL}/api/products`, fetcher);

  function handleConnectShopify() {
    window.location.href = `${API_URL}/api/shopify/auth`;
  }

  async function handleSyncShopify() {
    setSyncingShopify(true);
    try {
      const result = await api.syncShopify() as { synced?: number; message?: string; detail?: string };
      if (result.detail) {
        handleConnectShopify();
        return;
      }
      toast("success", "Shopify Synced", `${result.synced ?? 0} products synced.`);
    } catch {
      toast("error", "Sync Failed", "Could not connect to Shopify.");
    } finally {
      setSyncingShopify(false);
    }
  }

  async function handlePublish(postId: string) {
    setPublishingId(postId);
    try {
      await api.publishPost(postId);
      toast("success", "Post Published", "Your post is now live.");
      mutatePosts();
    } catch {
      toast("error", "Publish Failed", "Could not publish the post.");
    } finally {
      setPublishingId(null);
    }
  }

  async function handleDelete(postId: string) {
    if (!confirm("Delete this post?")) return;
    setDeletingId(postId);
    try {
      await api.deletePost(postId);
      toast("success", "Post Deleted");
      mutatePosts();
    } catch {
      toast("error", "Delete Failed");
    } finally {
      setDeletingId(null);
    }
  }

  const quickActions = [
    {
      href: "/compose",
      icon: PenLine,
      label: "Create New Post",
      desc: "Generate AI-powered content",
      color: "bg-gold text-navy",
      hoverColor: "hover:bg-gold/90",
    },
    {
      href: "/research",
      icon: TrendingUp,
      label: "Research Trends",
      desc: "Find trending hashtags & topics",
      color: "bg-navy text-cream",
      hoverColor: "hover:bg-navy-light",
    },
    {
      href: "/influencers",
      icon: Users,
      label: "Find Influencers",
      desc: "Discover brand partners",
      color: "bg-navy text-cream",
      hoverColor: "hover:bg-navy-light",
    },
    {
      href: "#",
      icon: RefreshCw,
      label: "Sync Shopify",
      desc: "Update product catalog",
      color: "bg-cream-dark text-navy",
      hoverColor: "hover:bg-cream-dark/80",
      onClick: handleSyncShopify,
      loading: syncingShopify,
    },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-navy">
          🍺 Dashboard
        </h1>
        <p className="text-navy/60 mt-1">
          Welcome back — here&apos;s your publishing overview.
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statsLoading || productsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="stat-card animate-pulse">
              <div className="w-10 h-10 rounded-lg bg-cream-dark mb-3" />
              <div className="h-7 w-16 bg-cream-dark rounded mb-1" />
              <div className="h-4 w-24 bg-cream-dark rounded" />
            </div>
          ))
        ) : (
          <>
            <StatCard
              icon={BarChart3}
              label="Total Posts"
              value={stats?.total_posts ?? (Array.isArray(posts) ? posts.length : 0)}
              color="bg-navy/10 text-navy"
            />
            <StatCard
              icon={CheckCircle2}
              label="Published This Week"
              value={stats?.published_this_week ?? 0}
              color="bg-green-100 text-green-700"
            />
            <StatCard
              icon={FileText}
              label="Draft Posts"
              value={stats?.draft_posts ?? (Array.isArray(posts) ? posts.filter((p) => p.status === "draft").length : 0)}
              color="bg-gold/20 text-gold"
            />
            <StatCard
              icon={Package}
              label="Total Products"
              value={stats?.total_products ?? (Array.isArray(products) ? products.length : 0)}
              color="bg-red/10 text-red"
            />
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-navy mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            const inner = (
              <div
                className={`card p-5 flex flex-col gap-3 cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${action.loading ? "opacity-60" : ""}`}
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${action.color}`}
                >
                  <Icon
                    className={`w-5 h-5 ${action.loading ? "animate-spin" : ""}`}
                    strokeWidth={2}
                  />
                </div>
                <div>
                  <p className="font-bold text-navy text-sm">{action.label}</p>
                  <p className="text-xs text-navy/50 mt-0.5">{action.desc}</p>
                </div>
              </div>
            );

            if (action.onClick) {
              return (
                <button
                  key={action.label}
                  onClick={action.onClick}
                  disabled={action.loading}
                  className="text-left w-full"
                >
                  {inner}
                </button>
              );
            }

            return (
              <Link key={action.label} href={action.href}>
                {inner}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Platform Status */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-navy mb-4">Platform Status</h2>
        <div className="card p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { platform: "instagram" as const, label: "Instagram", status: "connected", handle: "@vintagebudthreads" },
              { platform: "facebook" as const, label: "Facebook", status: "connected", handle: "Vintage Bud Threads" },
              { platform: "tiktok" as const, label: "TikTok", status: "setup_required", handle: "Not connected" },
            ].map((p) => (
              <div key={p.platform} className="flex items-center gap-3">
                <PlatformBadge platform={p.platform} size="sm" showLabel={false} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-navy">{p.label}</p>
                  <p className="text-xs text-navy/50 truncate">{p.handle}</p>
                </div>
                {p.status === "connected" ? (
                  <span className="flex-shrink-0 w-2 h-2 rounded-full bg-green-500" />
                ) : (
                  <span className="flex-shrink-0 text-xs text-gold font-semibold">Setup</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Posts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-navy">Recent Posts</h2>
          <Link href="/campaigns" className="text-sm text-gold font-semibold hover:text-gold-light">
            View all →
          </Link>
        </div>

        <div className="card p-0 overflow-hidden">
          {postsLoading ? (
            <div className="p-8 text-center">
              <div className="inline-flex gap-1.5 dot-pulse text-navy/30">
                <span /><span /><span />
              </div>
              <p className="text-navy/50 text-sm mt-3">Loading posts...</p>
            </div>
          ) : !posts || posts.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-cream-dark rounded-full flex items-center justify-center mx-auto mb-4">
                <PenLine className="w-8 h-8 text-navy/30" />
              </div>
              <p className="font-bold text-navy">No posts yet</p>
              <p className="text-navy/50 text-sm mt-1 mb-4">
                Create your first post to get started
              </p>
              <Link href="/compose" className="btn-primary">
                <Plus className="w-4 h-4" />
                Create Post
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-cream-dark bg-cream/50">
                    <th className="text-left text-xs font-semibold text-navy/50 uppercase tracking-wider px-5 py-3">
                      Platform
                    </th>
                    <th className="text-left text-xs font-semibold text-navy/50 uppercase tracking-wider px-5 py-3">
                      Caption
                    </th>
                    <th className="text-left text-xs font-semibold text-navy/50 uppercase tracking-wider px-5 py-3">
                      Status
                    </th>
                    <th className="text-left text-xs font-semibold text-navy/50 uppercase tracking-wider px-5 py-3">
                      Date
                    </th>
                    <th className="text-right text-xs font-semibold text-navy/50 uppercase tracking-wider px-5 py-3">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post, i) => (
                    <tr
                      key={post.id}
                      className={`border-b border-cream-dark/50 hover:bg-cream/40 transition-colors ${
                        i === posts.length - 1 ? "border-b-0" : ""
                      }`}
                    >
                      <td className="px-5 py-3.5">
                        <PlatformBadge platform={post.platform} size="sm" />
                      </td>
                      <td className="px-5 py-3.5 max-w-xs">
                        <p className="text-sm text-navy truncate">
                          {post.caption || "No caption"}
                        </p>
                        {post.hashtags?.length > 0 && (
                          <p className="text-xs text-navy/40 truncate mt-0.5">
                            {post.hashtags.slice(0, 3).map((h) => `#${h}`).join(" ")}
                            {post.hashtags.length > 3 && ` +${post.hashtags.length - 3}`}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={post.status} />
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-sm text-navy/60">
                          {new Date(post.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          {post.status === "draft" && (
                            <button
                              onClick={() => handlePublish(post.id)}
                              disabled={publishingId === post.id}
                              className="btn-primary py-1.5 px-3 text-xs"
                              title="Publish"
                            >
                              <Send
                                className={`w-3.5 h-3.5 ${publishingId === post.id ? "animate-pulse" : ""}`}
                              />
                              Publish
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(post.id)}
                            disabled={deletingId === post.id}
                            className="btn-ghost py-1.5 px-2.5 text-xs text-red/70 hover:text-red hover:bg-red/10"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
