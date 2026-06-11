import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Ban,
  CarFront,
  CheckCircle2,
  Eye,
  Pencil,
  Play,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ActionIconButton } from "@/components/ui/action-buttons/ActionIconButton";
import { AppPagination } from "@/components/ui/pagination/AppPagination";
import type { Reservation } from "@/types/reservation";
import { formatCarName, formatRegistrationNumber } from "@/utils/car";
import { normalizeClientName } from "@/utils/client";
import { formatDateTime } from "@/utils/date";
import { formatMoney } from "@/utils/money";
import { cn } from "@/lib/utils";
import {
  getClientIdentity,
  getInitials,
  statusColorClasses,
  statusDotClasses,
  type ReservationViewModel,
} from "@/pages/reservations/components/reservationViewUtils";
import { useToast } from "@/hooks/useToast";
import { readStoredPageSize, writeStoredPageSize } from "@/lib/pagination";

interface ReservationDataGridProps {
  items: ReservationViewModel[];
  onArchive: (reservation: Reservation) => void;
  onArchiveSelected: (reservations: Reservation[]) => void | Promise<void>;
  onCreate: () => void;
  onEdit: (reservation: Reservation) => void;
  onSelect: (reservation: Reservation) => void;
  onStatusChange: (id: number, status: Reservation["status"]) => void | Promise<void>;
}

const reservationsPageSizeKey = "massar-pagination-page-size-reservations";

export function ReservationDataGrid({ items, onArchive, onArchiveSelected, onCreate, onEdit, onSelect, onStatusChange }: ReservationDataGridProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => readStoredPageSize(reservationsPageSizeKey));
  const [selectedReservationIds, setSelectedReservationIds] = useState<number[]>([]);
  const [bulkActionsOpen, setBulkActionsOpen] = useState(false);
  const { showToast } = useToast();
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    setPage(1);
  }, [items.length, pageSize]);

  useEffect(() => {
    setSelectedReservationIds((current) => current.filter((id) => items.some((item) => item.reservation.id === id)));
  }, [items]);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, pageSize, safePage]);

  const selectedReservationIdsSet = useMemo(() => new Set(selectedReservationIds), [selectedReservationIds]);
  const visibleReservationIds = pageItems.map((item) => item.reservation.id);
  const allVisibleReservationsSelected =
    visibleReservationIds.length > 0 && visibleReservationIds.every((id) => selectedReservationIdsSet.has(id));
  const displayStart = items.length ? (safePage - 1) * pageSize + 1 : 0;
  const displayEnd = Math.min(safePage * pageSize, items.length);

  function toggleReservationSelection(id: number) {
    setSelectedReservationIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleVisibleReservations() {
    setSelectedReservationIds((current) => {
      if (allVisibleReservationsSelected) return current.filter((id) => !visibleReservationIds.includes(id));
      return Array.from(new Set([...current, ...visibleReservationIds]));
    });
  }

  function handlePageSizeChange(nextPageSize: number) {
    setPageSize(nextPageSize);
    writeStoredPageSize(reservationsPageSizeKey, nextPageSize);
  }

  async function handleBulkStatus(status: Reservation["status"]) {
    if (!selectedReservationIds.length) {
      showToast({ message: "Cochez au moins une réservation dans la liste.", title: "Aucune sélection", type: "info" });
      setBulkActionsOpen(false);
      return;
    }

    const ids = getBulkStatusIds(items, selectedReservationIds, status);
    if (!ids.length && status === "ONGOING") {
      showToast({ message: "La voiture a deja une location en cours.", title: "Action impossible", type: "info" });
      setBulkActionsOpen(false);
      return;
    }

    if (!ids.length) {
      showToast({ message: "Seules les réservations à venir peuvent être annulées.", title: "Action impossible", type: "info" });
      setBulkActionsOpen(false);
      return;
    }

    await Promise.all(ids.map((id) => onStatusChange(id, status)));
    setSelectedReservationIds([]);
    setBulkActionsOpen(false);
  }

  async function handleBulkArchive() {
    if (!selectedReservationIds.length) {
      showToast({ message: "Cochez au moins une réservation dans la liste.", title: "Aucune sélection", type: "info" });
      setBulkActionsOpen(false);
      return;
    }

    const selectedReservations = items
      .filter((item) => selectedReservationIds.includes(item.reservation.id))
      .map((item) => item.reservation);
    await onArchiveSelected(selectedReservations);
    setSelectedReservationIds([]);
    setBulkActionsOpen(false);
  }

  return (
    <Card className="overflow-hidden rounded-xl p-0 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-muted-foreground dark:text-slate-400">
          {selectedReservationIds.length
            ? `${selectedReservationIds.length} réservation${selectedReservationIds.length > 1 ? "s" : ""} sélectionnée${
                selectedReservationIds.length > 1 ? "s" : ""
              }`
            : "Sélectionnez des réservations pour appliquer une action groupée"}
        </div>
        <div className="relative self-start md:self-auto">
          <Button
            className="h-10 rounded-lg border-slate-200 bg-white px-4 shadow-sm dark:border-slate-800 dark:bg-slate-950"
            onClick={() => setBulkActionsOpen((current) => !current)}
            type="button"
            variant="outline"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Actions sélection
          </Button>
          {bulkActionsOpen && (
            <div className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-800 dark:bg-slate-950">
              <p className="px-2 pb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                {selectedReservationIds.length} réservation{selectedReservationIds.length > 1 ? "s" : ""} sélectionnée
                {selectedReservationIds.length > 1 ? "s" : ""}
              </p>
              <BulkActionButton disabled={!selectedReservationIds.length} onClick={() => void handleBulkStatus("ONGOING")}>
                <Play className="h-4 w-4" />
                Démarrer sélection
              </BulkActionButton>
              <BulkActionButton disabled={!selectedReservationIds.length} onClick={() => void handleBulkStatus("COMPLETED")}>
                <CheckCircle2 className="h-4 w-4" />
                Terminer sélection
              </BulkActionButton>
              <BulkActionButton disabled={!selectedReservationIds.length} danger onClick={() => void handleBulkStatus("CANCELLED")}>
                <Ban className="h-4 w-4" />
                Annuler sélection
              </BulkActionButton>
              <BulkActionButton disabled={!selectedReservationIds.length} onClick={() => void handleBulkArchive()}>
                <Archive className="h-4 w-4" />
                Archiver sélection
              </BulkActionButton>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1280px] border-collapse">
          <thead>
            <tr className="border-b border-border bg-slate-50/80 text-left text-xs font-bold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
              <th className="w-14 px-5 py-4">
                <input
                  aria-label="Sélectionner les réservations visibles"
                  checked={allVisibleReservationsSelected}
                  className="h-4 w-4 rounded border-slate-300 accent-blue-600 dark:border-slate-700"
                  disabled={!visibleReservationIds.length}
                  onChange={toggleVisibleReservations}
                  type="checkbox"
                />
              </th>
              <th className="px-5 py-4">Client</th>
              <th className="px-5 py-4">Voiture</th>
              <th className="px-5 py-4">Période</th>
              <th className="px-5 py-4">Montants</th>
              <th className="px-5 py-4">Caution</th>
              <th className="px-5 py-4">Statut réservation</th>
              <th className="px-5 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.length ? (
              pageItems.map((item) => (
                <ReservationRow
                  hasActiveRentalForCar={hasActiveRentalForCar(items, item.reservation)}
                  item={item}
                  key={item.reservation.id}
                  onArchive={onArchive}
                  onEdit={onEdit}
                  onSelect={onSelect}
                  onStatusChange={onStatusChange}
                  selected={selectedReservationIdsSet.has(item.reservation.id)}
                  onToggleSelection={toggleReservationSelection}
                />
              ))
            ) : (
              <tr>
                <td colSpan={8}>
                  <div className="flex min-h-[340px] flex-col items-center justify-center gap-4 px-6 py-12 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-200">
                      <CarFront className="h-7 w-7" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-slate-950 dark:text-slate-100">Aucune réservation trouvée</p>
                      <p className="mt-1 text-sm text-muted-foreground dark:text-slate-400">Essayez de modifier les filtres ou créez une réservation.</p>
                    </div>
                    <Button onClick={onCreate} type="button">
                      <Plus className="h-4 w-4" />
                      Nouvelle réservation
                    </Button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-border px-5 py-4 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm text-muted-foreground dark:text-slate-400">
          Affichage de {displayStart} à {displayEnd} sur {items.length} réservations
          {selectedReservationIds.length > 0
            ? ` · ${selectedReservationIds.length} sélectionnée${selectedReservationIds.length > 1 ? "s" : ""}`
            : ""}
        </p>
        <div className="min-w-0 flex-1 lg:flex lg:justify-end">
          <AppPagination
            currentPage={safePage}
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
            pageSize={pageSize}
            totalItems={items.length}
            totalPages={totalPages}
          />
        </div>
      </div>
    </Card>
  );
}

function ReservationRow({
  hasActiveRentalForCar,
  item,
  onArchive,
  onEdit,
  onSelect,
  onStatusChange,
  onToggleSelection,
  selected,
}: {
  hasActiveRentalForCar: boolean;
  item: ReservationViewModel;
  onArchive: (reservation: Reservation) => void;
  onEdit: (reservation: Reservation) => void;
  onSelect: (reservation: Reservation) => void;
  onStatusChange: (id: number, status: Reservation["status"]) => void | Promise<void>;
  onToggleSelection: (id: number) => void;
  selected: boolean;
}) {
  const { car, client, depositCollected, depositRefunded, durationDays, paid, remaining, reservation } = item;
  const depositStatus = getDepositStatus(reservation.depositAmount, depositCollected, depositRefunded);

  return (
    <tr
      className={cn(
        "group cursor-pointer border-b border-border bg-white transition-smooth hover:bg-blue-50/40 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-blue-950/20",
        selected && "bg-blue-50/70 hover:bg-blue-50 dark:bg-blue-950/30 dark:hover:bg-blue-950/40",
      )}
      onClick={() => onSelect(reservation)}
    >
      <td className="px-5 py-5" onClick={(event) => event.stopPropagation()}>
        <input
          aria-label={`Sélectionner la réservation ${reservation.id}`}
          checked={selected}
          className="h-4 w-4 rounded border-slate-300 accent-blue-600 dark:border-slate-700"
          onChange={() => onToggleSelection(reservation.id)}
          type="checkbox"
        />
      </td>
      <td className="px-5 py-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-200">
            {getInitials(client?.fullName)}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-950 dark:text-slate-100">
              {client ? normalizeClientName(client.fullName) : "Client inconnu"}
            </p>
            <p className="truncate text-xs text-muted-foreground dark:text-slate-400">{getClientIdentity(client)}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-5">
        <div className="flex min-w-0 items-center gap-3">
          <CarThumb car={car} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-950 dark:text-slate-100">
              {car ? formatCarName(car.brand, car.model) : "Voiture inconnue"}
            </p>
            <p className="truncate text-xs text-muted-foreground dark:text-slate-400">
              {car ? formatRegistrationNumber(car.registrationNumber) : "Immatriculation -"}
            </p>
          </div>
        </div>
      </td>
      <td className="px-5 py-5">
        <div className="space-y-1 text-sm">
          <p className="font-medium text-slate-900 dark:text-slate-100">{formatDateTime(reservation.startDate)}</p>
          <p className="text-muted-foreground dark:text-slate-400">{formatDateTime(reservation.endDate)}</p>
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">{durationDays} jour{durationDays > 1 ? "s" : ""}</p>
        </div>
      </td>
      <td className="px-5 py-5">
        <div className="space-y-1 text-sm">
          <MoneyLine label="Dû" value={reservation.totalPrice} />
          <MoneyLine label="Payé" value={paid} />
          <MoneyLine label="Reste" tone={remaining > 0 ? "danger" : "success"} value={remaining} />
        </div>
      </td>
      <td className="px-5 py-5">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-950 dark:text-slate-100">{formatMoney(reservation.depositAmount)}</p>
          <span
            className={cn(
              "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
              depositStatus === "Restituée"
                ? "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
                : depositStatus === "Encaissée"
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900"
                  : "bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-950/40 dark:text-orange-200 dark:ring-orange-900",
            )}
          >
            {depositStatus}
          </span>
        </div>
      </td>
      <td className="px-5 py-5">
        <ReservationStatusBadge status={reservation.status} />
      </td>
      <td className="px-5 py-5">
        <div className="flex justify-end gap-2" onClick={(event) => event.stopPropagation()}>
          <ActionIconButton color="blue" icon={Eye} label="Voir détails" onClick={() => onSelect(reservation)} />
          {reservation.status !== "COMPLETED" && reservation.status !== "CANCELLED" && (
            <ActionIconButton color="amber" icon={Pencil} label="Modifier" onClick={() => onEdit(reservation)} />
          )}
          {(reservation.status === "EN_ATTENTE" || reservation.status === "RESERVED") && (
            <ActionIconButton color="emerald" icon={Play} label="Démarrer" onClick={() => void onStatusChange(reservation.id, "ONGOING")} />
          )}
          {reservation.status === "ONGOING" && (
            <ActionIconButton color="emerald" icon={CheckCircle2} label="Terminer" onClick={() => void onStatusChange(reservation.id, "COMPLETED")} />
          )}
          {(reservation.status === "EN_ATTENTE" || reservation.status === "RESERVED") && !hasActiveRentalForCar && (
            <ActionIconButton color="red" icon={Ban} label="Annuler" onClick={() => void onStatusChange(reservation.id, "CANCELLED")} />
          )}
          <ActionIconButton color="violet" icon={Archive} label="Archiver" onClick={() => onArchive(reservation)} />
        </div>
      </td>
    </tr>
  );
}

function hasActiveRentalForCar(items: ReservationViewModel[], reservation: Reservation) {
  return items.some(
    (item) =>
      item.reservation.id !== reservation.id &&
      item.reservation.carId === reservation.carId &&
      item.reservation.status === "ONGOING",
  );
}

function getBulkStatusIds(items: ReservationViewModel[], selectedIds: number[], status: Reservation["status"]) {
  if (status === "CANCELLED") {
    return items
      .filter(
        (item) =>
          selectedIds.includes(item.reservation.id) &&
          (item.reservation.status === "EN_ATTENTE" || item.reservation.status === "RESERVED"),
      )
      .map((item) => item.reservation.id);
  }

  if (status !== "ONGOING") return selectedIds;

  const startedCarIds = new Set<number>();
  return items
    .filter((item) => {
      const reservation = item.reservation;
      if (!selectedIds.includes(reservation.id)) return false;
      if (reservation.status !== "EN_ATTENTE" && reservation.status !== "RESERVED") return false;
      if (hasActiveRentalForCar(items, reservation)) return false;
      if (startedCarIds.has(reservation.carId)) return false;
      startedCarIds.add(reservation.carId);
      return true;
    })
    .map((item) => item.reservation.id);
}

function CarThumb({ car }: { car?: ReservationViewModel["car"] }) {
  if (car?.imageUrl) {
    return <img alt={formatCarName(car.brand, car.model)} className="h-12 w-16 rounded-lg object-cover" src={car.imageUrl} />;
  }

  return (
    <div className="flex h-12 w-16 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
      <CarFront className="h-6 w-6" />
    </div>
  );
}

function MoneyLine({ label, tone, value }: { label: string; tone?: "danger" | "success"; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground dark:text-slate-400">{label}</span>
      <span
        className={cn(
          "font-semibold text-slate-950 dark:text-slate-100",
          tone === "danger" && "text-red-600 dark:text-red-300",
          tone === "success" && "text-emerald-600 dark:text-emerald-300",
        )}
      >
        {formatMoney(value)}
      </span>
    </div>
  );
}

function ReservationStatusBadge({ status }: { status: Reservation["status"] }) {
  const labels: Record<Reservation["status"], string> = {
    CANCELLED: "Annulée",
    COMPLETED: "Terminée",
    EN_ATTENTE: "À venir",
    ONGOING: "En cours",
    RESERVED: "Confirmée",
  };

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1", statusColorClasses[status])}>
      <span className={cn("h-1.5 w-1.5 rounded-full", statusDotClasses[status])} />
      {labels[status]}
    </span>
  );
}

function BulkActionButton({
  children,
  danger,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        danger
          ? "text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/30"
          : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-900",
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function getDepositStatus(amount: number, collected: number, refunded: number) {
  if (refunded > 0) return "Restituée";
  if (amount > 0 && collected >= amount) return "Encaissée";
  return "À encaisser";
}

