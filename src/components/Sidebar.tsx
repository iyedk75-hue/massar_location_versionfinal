import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { CarFront } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { chevronIcons, moreNavigationItem, moreNavigationItems, navigationItems } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { readDisplaySettings, settingsChangedEvent } from "@/utils/settings";

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const { user } = useAuth();
  const location = useLocation();
  const [settings, setSettings] = useState(() => readDisplaySettings());
  const isMoreActive = moreNavigationItems.some((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`));
  const [moreOpen, setMoreOpen] = useState(isMoreActive);
  const displayName = settings.adminName || user?.fullName || "Utilisateur";
  const MoreIcon = moreNavigationItem.icon;
  const ChevronIcon = moreOpen ? chevronIcons.up : chevronIcons.down;

  useEffect(() => {
    function refreshSettings() {
      setSettings(readDisplaySettings());
    }

    window.addEventListener(settingsChangedEvent, refreshSettings);
    window.addEventListener("storage", refreshSettings);
    return () => {
      window.removeEventListener(settingsChangedEvent, refreshSettings);
      window.removeEventListener("storage", refreshSettings);
    };
  }, []);

  useEffect(() => {
    if (isMoreActive) {
      setMoreOpen(true);
    }
  }, [isMoreActive]);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden shrink-0 border-r border-slate-200 bg-white transition-smooth dark:border-slate-800 dark:bg-slate-950 md:block",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className={cn("flex h-16 items-center border-b border-slate-200 dark:border-slate-800", collapsed ? "justify-center px-0" : "gap-2 px-4")}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
          <CarFront className="h-4 w-4" />
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-5 text-foreground">{settings.agencyName || "Location Auto bizerte"}</p>
            <p className="truncate text-sm leading-5 text-muted-foreground">{displayName}</p>
          </div>
        )}
      </div>
      <nav className="space-y-1.5 p-3">
        {navigationItems.map((item) => (
          <NavLink
            className={({ isActive }) =>
              cn(
                "flex h-10 items-center rounded-lg text-sm font-semibold transition-smooth",
                collapsed ? "justify-center px-0" : "gap-3 px-3",
                isActive
                  ? "animate-fade-in bg-blue-900 text-white shadow-md dark:bg-blue-700"
                  : "text-slate-600 hover:bg-blue-50 hover:text-blue-900 active:scale-95 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white",
              )
            }
            end={item.path === "/"}
            key={item.path}
            title={collapsed ? item.label : undefined}
            to={item.path}
          >
            <item.icon className="h-4 w-4" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}

        <div className="space-y-1">
          <button
            aria-expanded={moreOpen}
            className={cn(
              "flex h-10 w-full items-center rounded-lg text-sm font-semibold transition-smooth active:scale-95",
              collapsed ? "justify-center px-0" : "gap-3 px-3",
              isMoreActive
                ? "bg-blue-900 text-white shadow-md dark:bg-blue-700"
                : "text-slate-600 hover:bg-blue-50 hover:text-blue-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white",
            )}
            onClick={() => setMoreOpen((open) => !open)}
            title={collapsed ? moreNavigationItem.label : undefined}
            type="button"
          >
            <MoreIcon className="h-4 w-4 shrink-0" />
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1 text-left">{moreNavigationItem.label}</span>
                <ChevronIcon className="h-4 w-4 shrink-0" />
              </>
            )}
          </button>

          {!collapsed && moreOpen && (
            <div className="ml-4 space-y-1 border-l border-slate-200 pl-3 dark:border-slate-800">
              {moreNavigationItems.map((item) => (
                <NavLink
                  className={({ isActive }) =>
                    cn(
                      "flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-smooth",
                      isActive
                        ? "bg-blue-50 text-blue-900 dark:bg-slate-800 dark:text-white"
                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 active:scale-95 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white",
                    )
                  }
                  key={item.path}
                  to={item.path}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              ))}
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
}
