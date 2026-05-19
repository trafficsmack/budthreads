"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Bell,
  Megaphone,
  MessageCircle,
  Layout,
  Users,
  Search,
  Compass,
  Settings,
  Beer,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

const mainNavItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/notifications", label: "Notifications", icon: Bell, badge: true },
  { href: "/campaigns", label: "Ads Manager", icon: Megaphone },
  { href: "/inbox", label: "Inbox", icon: MessageCircle },
  { href: "/compose", label: "Content", icon: Layout },
];

const secondaryNavItems = [
  { href: "/influencers", label: "Creator marketplace", icon: Users },
  { href: "/research", label: "Search", icon: Search, shortcut: "Ctrl+K" },
  { href: "/get-started", label: "Get started", icon: Compass },
];

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className="fixed top-0 left-0 h-screen w-[240px] bg-navy flex flex-col z-50">
      {/* Logo */}
      <div className="px-4 pt-5 pb-3">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-gold rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-gold-light transition-colors">
            <Beer className="w-4 h-4 text-navy" strokeWidth={2.5} />
          </div>
          <div className="leading-tight">
            <p className="text-cream font-bold text-sm leading-none">Vintage Bud</p>
            <p className="text-cream/50 text-[11px]">Threads</p>
          </div>
        </Link>
      </div>

      {/* Account selector */}
      <div className="px-3 pb-3">
        <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left">
          <div className="w-7 h-7 rounded-md bg-green-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-xs">V</span>
          </div>
          <span className="flex-1 text-cream text-sm font-medium truncate">Vintage Bud T...</span>
          <ChevronDown className="w-4 h-4 text-cream/50 flex-shrink-0" strokeWidth={2} />
        </button>
      </div>

      {/* Main navigation */}
      <nav className="flex-1 px-3 overflow-y-auto scrollbar-thin">
        <div className="space-y-0.5">
          {mainNavItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                  active
                    ? "bg-white/[0.18] text-cream"
                    : "text-cream/70 hover:text-cream hover:bg-white/10"
                )}
              >
                <Icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={active ? 2.5 : 2} />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="w-2 h-2 rounded-full bg-red flex-shrink-0" />
                )}
              </Link>
            );
          })}
        </div>

        <div className="my-3 border-t border-white/10" />

        <div className="space-y-0.5">
          {secondaryNavItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                  active
                    ? "bg-white/[0.18] text-cream"
                    : "text-cream/70 hover:text-cream hover:bg-white/10"
                )}
              >
                <Icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={active ? 2.5 : 2} />
                <span className="flex-1">{item.label}</span>
                {item.shortcut && (
                  <span className="text-[11px] text-cream/40 bg-white/10 px-1.5 py-0.5 rounded font-mono flex-shrink-0">
                    {item.shortcut}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Settings at bottom */}
      <div className="px-3 py-3 border-t border-white/10">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
            isActive("/settings")
              ? "bg-white/[0.18] text-cream"
              : "text-cream/70 hover:text-cream hover:bg-white/10"
          )}
        >
          <Settings className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={2} />
          <span>Settings</span>
        </Link>
      </div>
    </aside>
  );
}
