"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Globe, LayoutDashboard, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/websites/new", label: "Add Website", icon: Plus },
];

export function NavSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-white px-4 py-6">
      <div className="flex items-center gap-2 px-2 mb-8">
        <Globe className="h-6 w-6 text-zinc-900" />
        <span className="text-lg font-semibold text-zinc-900">WebMaintain</span>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname === href || pathname.startsWith(href + "/")
                ? "bg-zinc-100 text-zinc-900"
                : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="border-t pt-4">
        <div className="flex items-center gap-3 px-3 py-2">
          <UserButton />
          <span className="text-sm text-zinc-500">Account</span>
        </div>
      </div>
    </aside>
  );
}
