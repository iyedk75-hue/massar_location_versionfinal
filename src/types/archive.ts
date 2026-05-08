export type ArchiveType = "client" | "car" | "reservation" | "payment" | "contract";

export interface ArchiveItem {
  id: number;
  type: ArchiveType;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  archivedAt?: string | null;
  archivedReason?: string | null;
  status?: string | null;
  originalData: Record<string, unknown>;
}

export interface ArchiveStats {
  total: number;
  clients: number;
  cars: number;
  reservations: number;
  payments: number;
  contracts: number;
}
