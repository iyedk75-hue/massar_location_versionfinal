import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { CarFront } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { navigationItems } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { readDisplaySettings, settingsChangedEvent } from "@/utils/settings";

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState(() => readDisplaySettings());
  const displayName = settings.adminName || user?.fullName || "Utilisateur";

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

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden shrink-0 border-r border-border bg-white transition-smooth dark:bg-slate-950 md:block",
        collapsed ? "w-16" : "w-52",
      )}
    >
      <div className={cn("flex h-16 items-center border-b border-border", collapsed ? "justify-center px-0" : "gap-2 px-3")}>
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
      <nav className="space-y-1 p-3">
        {navigationItems.map((item) => (
          <NavLink
            className={({ isActive }) =>
              cn(
                "flex h-10 items-center rounded-md text-sm font-medium transition-smooth",
                collapsed ? "justify-center px-0" : "gap-3 px-3",
                isActive
                  ? "animate-fade-in bg-primary text-primary-foreground shadow-md dark:bg-blue-600"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95",
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
      </nav>
    </aside>
  );
}
