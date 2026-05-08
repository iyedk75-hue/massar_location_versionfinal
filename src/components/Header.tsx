import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CircleUserRound, LogOut, Menu, Moon, Settings, Sun, User } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/hooks/useAuth";
import { readDisplaySettings, settingsChangedEvent } from "@/utils/settings";

type ThemeMode = "light" | "dark";

const themeStorageKey = "rentaldesk:theme";

export function Header({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-border bg-white px-2 dark:bg-slate-900 md:px-2 md:pr-6">
      <div className="flex min-w-0 items-center gap-1">
        <button
          aria-label="Réduire ou ouvrir le menu"
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-smooth hover:bg-muted hover:text-foreground"
          onClick={onToggleSidebar}
          type="button"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell />
        <ThemeMenu />
        <ProfileMenu />
      </div>
    </header>
  );
}

function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [settings, setSettings] = useState(() => readDisplaySettings());
  const ref = useRef<HTMLDivElement>(null);
  const { logout, user } = useAuth();
  const agencyName = settings.agencyName || "Location Auto bizerte";

  const displayName = settings.adminName || user?.fullName || "Utilisateur";
  const initials = displayName
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

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

  async function handleLogout() {
    try {
      setLoggingOut(true);
      await logout();
    } finally {
      setOpen(false);
      setLoggingOut(false);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        aria-label="Profil utilisateur"
        className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-primary transition-smooth hover:bg-blue-100 dark:bg-slate-800 dark:text-blue-300 dark:hover:bg-slate-700"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <CircleUserRound className="h-5 w-5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 animate-fade-in rounded-xl border border-border bg-white shadow-xl dark:bg-slate-900 dark:border-slate-800">
          {/* User info header */}
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
              <p className="truncate text-xs text-muted-foreground">{agencyName}</p>
            </div>
          </div>

          {/* Menu items */}
          <div className="p-1">
            <Link
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground transition-smooth hover:bg-muted"
              onClick={() => setOpen(false)}
              to="/settings"
            >
              <Settings className="h-4 w-4 text-muted-foreground" />
              Paramètres
            </Link>

            <Link
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground transition-smooth hover:bg-muted"
              onClick={() => setOpen(false)}
              to="/settings"
            >
              <User className="h-4 w-4 text-muted-foreground" />
              {user?.username || "Mon profil"}
            </Link>
          </div>

          {/* Disconnect */}
          <div className="border-t border-border p-1">
            <button
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-red-600 transition-smooth hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
              disabled={loggingOut}
              onClick={() => void handleLogout()}
              type="button"
            >
              <LogOut className="h-4 w-4" />
              {loggingOut ? "Déconnexion..." : "Déconnecter"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ThemeMenu() {
  const [theme, setTheme] = useState<ThemeMode>(() => readStoredTheme());

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem(themeStorageKey, theme);
  }, [theme]);

  const ActiveIcon = theme === "dark" ? Moon : Sun;
  const nextTheme = theme === "dark" ? "light" : "dark";
  const nextThemeLabel = nextTheme === "dark" ? "sombre" : "clair";

  return (
    <button
      aria-label={`Passer au thème ${nextThemeLabel}`}
      className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-muted-foreground transition-smooth hover:bg-blue-50 hover:text-primary dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      onClick={() => setTheme(nextTheme)}
      title={`Passer au thème ${nextThemeLabel}`}
      type="button"
    >
      <ActiveIcon className="h-5 w-5" />
    </button>
  );
}

function readStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(themeStorageKey);
  return stored === "dark" ? "dark" : "light";
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}
