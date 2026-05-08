export const settingsStorageKey = "rentaldesk:settings";
export const settingsChangedEvent = "rentaldesk:settings-changed";

export type DisplaySettings = {
  adminName: string;
  agencyName: string;
};

export function readDisplaySettings(): DisplaySettings {
  if (typeof window === "undefined") return { adminName: "", agencyName: "" };

  try {
    const stored = window.localStorage.getItem(settingsStorageKey);
    if (!stored) return { adminName: "", agencyName: "" };

    const settings = JSON.parse(stored) as { adminName?: unknown; agencyName?: unknown; userName?: unknown };
    const adminName =
      typeof settings.adminName === "string"
        ? settings.adminName.trim()
        : typeof settings.userName === "string"
          ? settings.userName.trim()
          : "";

    return {
      adminName,
      agencyName: typeof settings.agencyName === "string" ? settings.agencyName.trim() : "",
    };
  } catch {
    return { adminName: "", agencyName: "" };
  }
}

export function notifySettingsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(settingsChangedEvent));
}
