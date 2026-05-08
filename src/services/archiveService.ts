import { invokeCommand } from "@/services/invoke";
import type { ArchiveItem, ArchiveStats, ArchiveType } from "@/types/archive";

type CollectionName = "clients" | "cars" | "reservations" | "payments" | "contracts";

const collectionByType: Record<ArchiveType, CollectionName> = {
  car: "cars",
  client: "clients",
  contract: "contracts",
  payment: "payments",
  reservation: "reservations",
};

const typeByCollection: Record<CollectionName, ArchiveType> = {
  cars: "car",
  clients: "client",
  contracts: "contract",
  payments: "payment",
  reservations: "reservation",
};

export async function getArchiveStats() {
  if (isTauri()) return invokeCommand<ArchiveStats>("get_archive_stats");
  const items = getLocalArchivedItems();
  return buildStats(items);
}

export async function getArchivedItems() {
  if (isTauri()) return invokeCommand<ArchiveItem[]>("get_archived_items");
  return getLocalArchivedItems();
}

export async function searchArchivedItems(query: string, type: ArchiveType | "all") {
  const items = await getArchivedItems();
  const normalizedQuery = query.trim().toLowerCase();

  return items.filter((item) => {
    const matchesType = type === "all" || item.type === type;
    const haystack = `${item.title} ${item.subtitle ?? ""} ${item.description ?? ""} ${item.status ?? ""} ${
      item.archivedReason ?? ""
    } ${JSON.stringify(item.originalData)}`.toLowerCase();
    const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
    return matchesType && matchesQuery;
  });
}

export async function archiveItem(type: ArchiveType, id: number, reason: string) {
  if (isTauri()) return invokeCommand<void>("archive_item", { id, itemType: type, reason });
  const collectionName = collectionByType[type];
  const now = new Date().toISOString();
  writeCollection(
    collectionName,
    readCollection(collectionName).map((item) =>
      Number(item.id) === id
        ? {
            ...item,
            archived: true,
            archivedAt: now,
            archivedReason: reason,
            updatedAt: now,
          }
        : item,
    ),
  );
}

export async function restoreArchivedItem(type: ArchiveType, id: number) {
  if (isTauri()) return invokeCommand<void>("restore_archived_item", { id, itemType: type });
  const collectionName = collectionByType[type];
  writeCollection(
    collectionName,
    readCollection(collectionName).map((item) =>
      Number(item.id) === id
        ? {
            ...item,
            archived: false,
            archivedAt: null,
            archivedReason: null,
            updatedAt: new Date().toISOString(),
          }
        : item,
    ),
  );
}

export async function permanentlyDeleteArchivedItem(type: ArchiveType, id: number) {
  if (isTauri()) return invokeCommand<void>("permanently_delete_archived_item", { id, itemType: type });
  const collectionName = collectionByType[type];
  writeCollection(
    collectionName,
    readCollection(collectionName).filter((item) => Number(item.id) !== id),
  );
}

function getLocalArchivedItems() {
  return (Object.keys(typeByCollection) as CollectionName[]).flatMap((collectionName) =>
    readCollection(collectionName)
      .filter((item) => item.archived === true)
      .map((item) => toArchiveItem(typeByCollection[collectionName], item)),
  );
}

function toArchiveItem(type: ArchiveType, item: Record<string, unknown>): ArchiveItem {
  const titleByType: Record<ArchiveType, string> = {
    car: `${item.brand ?? "Voiture"} ${item.model ?? ""}`.trim(),
    client: String(item.fullName ?? "Client archivé"),
    contract: String(item.contractNumber ?? `Contrat #${item.id}`),
    payment: `${Number(item.amount ?? 0).toLocaleString("fr-FR")} DT`,
    reservation: `Réservation #${item.id}`,
  };
  const subtitleByType: Record<ArchiveType, string> = {
    car: String(item.registrationNumber ?? ""),
    client: String(item.cin ?? item.phone ?? ""),
    contract: `Réservation #${item.reservationId ?? "-"}`,
    payment: `Paiement #${item.id}`,
    reservation: `Client #${item.clientId ?? "-"} | Voiture #${item.carId ?? "-"}`,
  };

  return {
    archivedAt: String(item.archivedAt ?? ""),
    archivedReason: String(item.archivedReason ?? ""),
    description: buildLocalDescription(type, item),
    id: Number(item.id),
    originalData: item,
    status: String(item.status ?? item.type ?? ""),
    subtitle: subtitleByType[type],
    title: titleByType[type],
    type,
  };
}

function buildLocalDescription(type: ArchiveType, item: Record<string, unknown>) {
  if (type === "payment") return `${item.type ?? "Paiement"} | ${item.method ?? ""}`;
  if (type === "reservation") return `${item.startDate ?? ""} -> ${item.endDate ?? ""}`;
  if (type === "contract") return `Statut ${item.status ?? "-"}`;
  if (type === "car") return `${item.fuelType ?? ""} | ${item.transmission ?? ""}`;
  return String(item.phone ?? "");
}

function buildStats(items: ArchiveItem[]): ArchiveStats {
  return {
    cars: items.filter((item) => item.type === "car").length,
    clients: items.filter((item) => item.type === "client").length,
    contracts: items.filter((item) => item.type === "contract").length,
    payments: items.filter((item) => item.type === "payment").length,
    reservations: items.filter((item) => item.type === "reservation").length,
    total: items.length,
  };
}

function readCollection(collection: CollectionName): Record<string, unknown>[] {
  if (typeof window === "undefined") return [];
  const stored = window.localStorage.getItem(`rentaldesk:${collection}`);
  if (!stored) return [];
  try {
    return JSON.parse(stored) as Record<string, unknown>[];
  } catch {
    return [];
  }
}

function writeCollection(collection: CollectionName, value: Record<string, unknown>[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`rentaldesk:${collection}`, JSON.stringify(value));
}

function isTauri() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
