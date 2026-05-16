import { cn } from "@/lib/utils";

type Platform = "instagram" | "facebook" | "tiktok";

interface PlatformBadgeProps {
  platform: Platform;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const platformConfig: Record<
  Platform,
  { label: string; icon: string; className: string }
> = {
  instagram: {
    label: "Instagram",
    icon: "📸",
    className:
      "bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white",
  },
  facebook: {
    label: "Facebook",
    icon: "👥",
    className: "bg-blue-600 text-white",
  },
  tiktok: {
    label: "TikTok",
    icon: "🎵",
    className: "bg-gray-900 text-white border border-teal-400",
  },
};

const sizeClasses = {
  sm: "text-xs px-2 py-0.5 gap-1",
  md: "text-sm px-2.5 py-1 gap-1.5",
  lg: "text-base px-3 py-1.5 gap-2",
};

export default function PlatformBadge({
  platform,
  size = "md",
  showLabel = true,
  className,
}: PlatformBadgeProps) {
  const config = platformConfig[platform];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-semibold",
        config.className,
        sizeClasses[size],
        className
      )}
    >
      <span role="img" aria-label={config.label}>
        {config.icon}
      </span>
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}
