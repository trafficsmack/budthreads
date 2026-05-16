"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PenLine,
  Megaphone,
  TrendingUp,
  Users,
  Settings,
  Beer,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/compose", label: "Compose", icon: PenLine },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/research", label: "Research", icon: TrendingUp },
  { href: "/influencers", label: "Influencers", icon: Users },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed top-0 left-0 h-screen w-[240px] bg-navy flex flex-col z-50">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-white/10">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 bg-gold rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-gold-light transition-colors">
            <Beer className="w-5 h-5 text-navy" strokeWidth={2.5} />
          </div>
          <div className="leading-tight">
            <p className="text-gold font-bold text-sm leading-none">Vintage Bud</p>
            <p className="text-cream/80 text-xs font-medium">Threads</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        <p className="px-4 pb-2 text-xs font-semibold text-cream/30 uppercase tracking-widest">
          Menu
        </p>
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                isActive ? "nav-link-active" : "nav-link"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-3 py-4 border-t border-white/10">
        <Link href="/settings" className="nav-link">
          <Settings className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
          <span>Settings</span>
        </Link>
        <div className="mt-4 px-4 py-3 rounded-lg bg-white/5">
          <p className="text-xs text-cream/40 leading-relaxed">
            Vintage Bud Threads
            <br />
            <span className="text-gold/60">Social Publishing v1.0</span>
          </p>
        </div>
      </div>
    </aside>
  );
}
