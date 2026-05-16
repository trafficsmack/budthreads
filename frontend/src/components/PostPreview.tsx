import { cn } from "@/lib/utils";

type Platform = "instagram" | "facebook" | "tiktok";

interface PostPreviewProps {
  platform: Platform;
  caption: string;
  hashtags: string[];
  imageUrl?: string;
  username?: string;
}

export default function PostPreview({
  platform,
  caption,
  hashtags,
  imageUrl,
  username = "vintagebudthreads",
}: PostPreviewProps) {
  const hashtagText = hashtags.map((h) => `#${h}`).join(" ");
  const fullCaption = [caption, hashtagText].filter(Boolean).join("\n\n");

  if (platform === "instagram") {
    return (
      <div className="w-full max-w-sm mx-auto rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-gray-100">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold to-red flex items-center justify-center">
            <span className="text-white text-xs font-bold">VB</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{username}</p>
            <p className="text-xs text-gray-500">Just now</p>
          </div>
          <span className="ml-auto text-gray-400 text-lg">···</span>
        </div>

        {/* Image */}
        <div className="aspect-square bg-gradient-to-br from-navy/10 to-cream-dark flex items-center justify-center">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt="Post preview"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-center p-4">
              <span className="text-5xl">🍺</span>
              <p className="text-sm text-navy/40 mt-2 font-medium">
                Media Preview
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-3 py-2 flex items-center gap-4 text-gray-500">
          <span className="text-xl cursor-pointer hover:text-red transition-colors">
            ♡
          </span>
          <span className="text-xl cursor-pointer">💬</span>
          <span className="text-xl cursor-pointer">↗</span>
          <span className="text-xl cursor-pointer ml-auto">🔖</span>
        </div>

        {/* Caption */}
        <div className="px-3 pb-3">
          <p className="text-sm text-gray-900 leading-relaxed line-clamp-4 whitespace-pre-line">
            <span className="font-semibold">{username}</span> {fullCaption}
          </p>
        </div>
      </div>
    );
  }

  if (platform === "facebook") {
    return (
      <div className="w-full max-w-lg mx-auto rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold to-red flex items-center justify-center">
            <span className="text-white text-sm font-bold">VB</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              Vintage Bud Threads
            </p>
            <p className="text-xs text-gray-500">Just now · 🌐</p>
          </div>
          <span className="ml-auto text-gray-400 text-sm">···</span>
        </div>

        {/* Caption */}
        {caption && (
          <div className="px-4 py-3">
            <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-line line-clamp-5">
              {fullCaption}
            </p>
          </div>
        )}

        {/* Image */}
        <div
          className={cn(
            "bg-gradient-to-br from-navy/10 to-cream-dark flex items-center justify-center",
            caption ? "aspect-video" : "aspect-square"
          )}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt="Post preview"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-center p-4">
              <span className="text-5xl">🍺</span>
              <p className="text-sm text-navy/40 mt-2 font-medium">
                Media Preview
              </p>
            </div>
          )}
        </div>

        {/* Reactions */}
        <div className="px-4 py-2 flex items-center justify-between border-t border-gray-100 text-sm text-gray-500">
          <span>👍 Like</span>
          <span>💬 Comment</span>
          <span>↗ Share</span>
        </div>
      </div>
    );
  }

  // TikTok
  return (
    <div className="w-full max-w-xs mx-auto rounded-xl overflow-hidden border border-gray-800 bg-black shadow-xl">
      {/* Video area */}
      <div className="relative" style={{ aspectRatio: "9/16", maxHeight: 400 }}>
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt="Post preview"
              className="w-full h-full object-cover opacity-70"
            />
          ) : (
            <div className="text-center p-4">
              <span className="text-5xl">🍺</span>
              <p className="text-xs text-white/40 mt-2">Video Preview</p>
            </div>
          )}
        </div>

        {/* Overlay UI */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
          <p className="text-white text-xs font-semibold mb-1">
            @{username}
          </p>
          <p className="text-white/90 text-xs leading-relaxed line-clamp-3 whitespace-pre-line">
            {fullCaption}
          </p>
        </div>

        {/* Right actions */}
        <div className="absolute right-2 bottom-16 flex flex-col items-center gap-4">
          <div className="text-center">
            <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center">
              <span className="text-white text-xs font-bold">VB</span>
            </div>
          </div>
          <div className="text-center">
            <span className="text-white text-2xl">♥</span>
            <p className="text-white text-xs">0</p>
          </div>
          <div className="text-center">
            <span className="text-white text-2xl">💬</span>
            <p className="text-white text-xs">0</p>
          </div>
          <div className="text-center">
            <span className="text-white text-2xl">↗</span>
            <p className="text-white text-xs">0</p>
          </div>
        </div>
      </div>
    </div>
  );
}
