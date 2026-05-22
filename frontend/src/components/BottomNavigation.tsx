"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Plus, CheckCircle2, Settings } from "lucide-react";

export default function BottomNavigation() {
  const pathname = usePathname();

  const navItems = [
    { label: "Home", href: "/dashboard", icon: Home },
    { label: "Add", href: "/reminder/new", icon: Plus, isAction: true },
    { label: "Completed", href: "/completed", icon: CheckCircle2 },
    { label: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 border-t border-slate-200 bg-white/95 backdrop-blur-lg pb-safe">
      <div className="mx-auto flex h-full max-w-md items-center justify-around px-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          
          if (item.isAction) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative -top-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 transition-transform active:scale-95 hover:bg-emerald-700"
                aria-label="Add reminder"
              >
                <Icon className="h-6 w-6 stroke-[2.5]" />
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center w-16 h-full transition-colors ${
                isActive 
                  ? "text-emerald-600" 
                  : "text-slate-500 active:text-slate-800"
              }`}
            >
              <Icon className="h-5 w-5 stroke-[2]" />
              <span className="mt-1 text-[10px] font-medium tracking-wide">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
