"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  PenLine,
  Plus,
  Trash2,
  Send,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  FileText,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { api, Post } from "@/lib/api";
import PlatformBadge from "@/components/PlatformBadge";
import { toast } from "@/components/Toaster";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const fetcher = (url: string) => fetch(url).then((r) => r.json());

type StatusFilter = "all" | Post["status"];
type PlatformFilter = "all" | "instagram" | "facebook" | "tiktok";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "failed", label: "Failed" },
];

const PLATFORM_FILTERS: { value: PlatformFilter; label: string; icon: string }[] = [
  { value: "all", label: "All Platforms", icon: "🌐" },
  { value: "instagram", label: "Instagram", icon: "📸" },
  { value: "facebook", label: "Facebook", icon: "👥" },
  { value: "tiktok", label: "TikTok", icon: "🎵" },
];

function StatusBadge({ status }: { status: Post["status"] }) {
  const configs = {
    published: { cls: "badge-published", icon: <CheckCircle2 className="w-3 h-3" />, label: "Published" },
    scheduled: { cls: "badge-scheduled", icon: <Clock className="w-3 h-3" />, label: "Scheduled" },
    draft: { cls: "badge-draft", icon: <FileText className="w-3 h-3" />, label: "Draft" },
    failed: { cls: "badge-failed", icon: <AlertCircle className="w-3 h-3" />, label: "Failed" },
  };
  const c = configs[status];
  return (
    <span className={c.cls}>
      {c.icon}
      {c.label}
    </span>
  );
}

function PostCard({
  post,
  onPublish,
  onDelete,
  publishingId,
  deletingId,
}: {
  post: Post;
  onPublish: (id: string) => void;
  onDelete: (id: string) => void;
  publishingId: string | null;
  deletingId: string | null;
}) {
  return (
    <div className="card p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        {/* Media thumbnail */}
        <div className="w-16 h-16 rounded-lg bg-cream-dark flex-shrink-0 overflow-hidden flex items-center justify-center">
          {post.media_urls && post.media_urls[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.media_urls[0]}
              alt="Post media"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-2xl">🍺</span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <PlatformBadge platform={post.platform} size="sm" />
            <StatusBadge status={post.status} />
          </div>

          <p className="text-sm text-navy leading-relaxed line-clamp-2 mt-1">
            {post.caption || "No caption"}
          </p>

          {post.hashtags && post.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {post.hashtags.slice(0, 5).map((tag) => (
                <span key={tag} className="text-xs text-navy/50 bg-navy/5 px-2 py-0.5 rounded-full">
                  #{tag}
                </span>
              ))}
              {post.hashtags.length > 5 && (
                <span className="text-xs text-navy/40">+{post.hashtags.length - 5}</span>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <p className="text-xs text-navy/40">
              Created{" "}
              {new Date(post.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
            {post.published_at && (
              <p className="text-xs text-green-600">
                · Published{" "}
                {new Date(post.published_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </p>
            )}
            {post.scheduled_at && post.status === "scheduled" && (
              <p className="text-xs text-yellow-600">
                · Scheduled for{" "}
                {new Date(post.scheduled_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 flex-shrink-0">
          {(post.status === "draft" || post.status === "failed") && (
            <button
              onClick={() => onPublish(post.id)}
              disabled={publishingId === post.id}
              className="btn-primary py-1.5 px-3 text-xs"
              title="Publish"
            >
              {publishingId === post.id ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              Publish
            </button>
          )}
          <button
            onClick={() => onDelete(post.id)}
            disabled={deletingId === post.id}
            className="btn-ghost py-1.5 px-2.5 text-xs text-red/60 hover:text-red hover:bg-red/10"
            title="Delete"
          >
            {deletingId === post.id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CampaignsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const queryParams = new URLSearchParams();
  if (statusFilter !== "all") queryParams.set("status", statusFilter);
  if (platformFilter !== "all") queryParams.set("platform", platformFilter);
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : "";

  const { data: posts, isLoading, mutate } = useSWR<Post[]>(
    `${API_URL}/api/posts${queryString}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  async function handlePublish(postId: string) {
    setPublishingId(postId);
    try {
      await api.publishPost(postId);
      toast("success", "Post Published", "Your post is now live.");
      mutate();
    } catch {
      toast("error", "Publish Failed", "Could not publish the post.");
    } finally {
      setPublishingId(null);
    }
  }

  async function handleDelete(postId: string) {
    if (!confirm("Delete this post? This cannot be undone.")) return;
    setDeletingId(postId);
    try {
      await api.deletePost(postId);
      toast("success", "Post Deleted");
      mutate();
    } catch {
      toast("error", "Delete Failed");
    } finally {
      setDeletingId(null);
    }
  }

  const filteredPosts = posts?.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.caption?.toLowerCase().includes(q) ||
      p.hashtags?.some((h) => h.toLowerCase().includes(q))
    );
  });

  const countByStatus = (status: StatusFilter) => {
    if (!posts) return 0;
    if (status === "all") return posts.length;
    return posts.filter((p) => p.status === status).length;
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-navy">📣 Campaigns</h1>
          <p className="text-navy/60 mt-1">Manage and track all your social posts.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => mutate()}
            className="btn-ghost text-sm"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link href="/compose" className="btn-primary">
            <Plus className="w-4 h-4" />
            New Post
          </Link>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 mb-4 bg-cream-dark/50 rounded-xl p-1 overflow-x-auto">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all flex-shrink-0",
              statusFilter === f.value
                ? "bg-white text-navy shadow-sm"
                : "text-navy/50 hover:text-navy"
            )}
          >
            {f.label}
            {posts && (
              <span
                className={cn(
                  "text-xs px-1.5 py-0.5 rounded-full",
                  statusFilter === f.value
                    ? "bg-navy/10 text-navy"
                    : "bg-navy/5 text-navy/40"
                )}
              >
                {countByStatus(f.value)}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Platform filter + Search */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy/30" />
          <input
            type="text"
            placeholder="Search captions, hashtags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-cream-dark bg-white text-navy text-sm focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold placeholder:text-navy/30"
          />
        </div>

        <div className="flex gap-2">
          <Filter className="w-4 h-4 text-navy/40 self-center flex-shrink-0" />
          {PLATFORM_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setPlatformFilter(f.value)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-all",
                platformFilter === f.value
                  ? "bg-navy text-cream border-navy"
                  : "bg-white text-navy/60 border-cream-dark hover:border-navy/30 hover:text-navy"
              )}
            >
              <span>{f.icon}</span>
              <span className="hidden sm:inline">{f.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Posts grid */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="flex gap-4">
                <div className="w-16 h-16 rounded-lg bg-cream-dark flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <div className="h-5 w-20 bg-cream-dark rounded-full" />
                    <div className="h-5 w-16 bg-cream-dark rounded-full" />
                  </div>
                  <div className="h-4 bg-cream-dark rounded w-3/4" />
                  <div className="h-4 bg-cream-dark rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : !filteredPosts || filteredPosts.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="w-20 h-20 bg-cream-dark rounded-full flex items-center justify-center mx-auto mb-6">
            <PenLine className="w-10 h-10 text-navy/20" />
          </div>
          {searchQuery || statusFilter !== "all" || platformFilter !== "all" ? (
            <>
              <p className="font-bold text-navy text-lg">No posts match your filters</p>
              <p className="text-navy/50 text-sm mt-1 mb-4">
                Try clearing your filters to see all posts.
              </p>
              <button
                onClick={() => {
                  setStatusFilter("all");
                  setPlatformFilter("all");
                  setSearchQuery("");
                }}
                className="btn-ghost text-sm"
              >
                Clear Filters
              </button>
            </>
          ) : (
            <>
              <p className="font-bold text-navy text-lg">No posts yet</p>
              <p className="text-navy/50 text-sm mt-1 mb-4">
                Create your first post to start building your social presence.
              </p>
              <Link href="/compose" className="btn-primary">
                <Plus className="w-4 h-4" />
                Create Your First Post
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-navy/50">
            Showing {filteredPosts.length} post{filteredPosts.length !== 1 ? "s" : ""}
          </p>
          {filteredPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onPublish={handlePublish}
              onDelete={handleDelete}
              publishingId={publishingId}
              deletingId={deletingId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
