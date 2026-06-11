import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  Archive,
  Car as CarIcon,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  Plus,
  Printer,
  RotateCcw,
  Search,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/app/layout";
import { ArchiveConfirmDialog } from "@/components/archive/ArchiveConfirmDialog";
import { ActionIconButton } from "@/components/ui/action-buttons/ActionIconButton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AppPagination } from "@/components/ui/pagination/AppPagination";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { ContractPDF } from "@/pages/contracts/ContractPDF";
import { getCars } from "@/services/car.service";
import { getClients } from "@/services/client.service";
import { getContracts } from "@/services/contract.service";
import { archiveItem } from "@/services/archiveService";
import { getReservations } from "@/services/reservation.service";
import type { Car } from "@/types/car";
import type { Client } from "@/types/client";
import type { Contract, ContractStatus } from "@/types/contract";
import type { Reservation } from "@/types/reservation";
import { formatCarName, formatRegistrationNumber } from "@/utils/car";
import { formatClientIdentity, normalizeClientName } from "@/utils/client";
import { getRentalDays } from "@/utils/date";
import { createContractPdf } from "@/utils/pdf";
import { useToast } from "@/hooks/useToast";
import { cn } from "@/lib/utils";
import { readStoredPageSize, writeStoredPageSize } from "@/lib/pagination";

// Types

type DisplayStatus = "GENERATED" | "PENDING" | "SIGNED" | "EXPIRED";

interface ContractRow {
  car?: Car;
  client?: Client;
  contract: Contract;
  displayStatus: DisplayStatus;
  durationDays: number;
  reservation?: Reservation;
  secondClient?: Client;
}

const contractsPageSizeKey = "massar-pagination-page-size-contracts";
const contractStatusFilterOptions = [
  { value: "ALL", label: "Tous les statuts" },
  { value: "GENERATED", label: "Généré" },
  { value: "PENDING", label: "En attente" },
  { value: "SIGNED", label: "Signé" },
  { value: "EXPIRED", label: "Expiré" },
];

const AVATAR_COLORS = [
  "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-orange-500",
  "bg-pink-500", "bg-teal-500", "bg-indigo-500", "bg-rose-500",
];

// Helpers

function computeDisplayStatus(contract: Contract, reservation?: Reservation): DisplayStatus {
  if (contract.status === "SIGNED") return "SIGNED";
  if (contract.status === "CANCELLED") return "EXPIRED";
  const now = new Date();
  if (!reservation) return "GENERATED";
  if (new Date(reservation.endDate) < now) return "EXPIRED";
  if (new Date(reservation.startDate) <= now) return "PENDING";
  return "GENERATED";
}

function getDisplayStatusLabel(status: DisplayStatus) {
  return { GENERATED: "Généré", PENDING: "En attente", SIGNED: "Signé", EXPIRED: "Expiré" }[status];
}

function getDisplayStatusStyle(status: DisplayStatus) {
  return {
    GENERATED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    PENDING: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    SIGNED: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    EXPIRED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  }[status];
}

function clientInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function avatarColor(id: number) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

function formatDateLine(value?: string | null): { date: string; time: string } {
  if (!value) return { date: "-", time: "" };
  const d = new Date(value);
  const date = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(d);
  const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(d);
  return { date, time };
}

function formatPeriodLines(reservation?: Reservation) {
  if (!reservation) return { start: "-", end: "", duration: "" };
  const fmt = (v: string) =>
    new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(v));
  const days = Math.max(1, getRentalDays(reservation.startDate, reservation.endDate));
  return {
    start: fmt(reservation.startDate),
    end: fmt(reservation.endDate),
    duration: `${days} jour${days > 1 ? "s" : ""}`,
  };
}

function monthKey(iso: string) {
  return iso.slice(0, 7);
}

function currentAndPrevMonthKeys() {
  const now = new Date();
  const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prev = now.getMonth() === 0
    ? `${now.getFullYear() - 1}-12`
    : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, "0")}`;
  return { cur, prev };
}

function trendLabel(cur: number, prev: number) {
  if (prev === 0) return cur > 0 ? "+100%" : null;
  const pct = Math.round(((cur - prev) / prev) * 100);
  return `${pct >= 0 ? "+" : ""}${pct}%`;
}

function searchMatch(row: ContractRow, query: string) {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    row.contract.contractNumber.toLowerCase().includes(q) ||
    (row.client ? normalizeClientName(row.client.fullName).toLowerCase().includes(q) : false) ||
    (row.client ? formatClientIdentity(row.client).toLowerCase().includes(q) : false) ||
    (row.secondClient ? normalizeClientName(row.secondClient.fullName).toLowerCase().includes(q) : false) ||
    (row.secondClient ? formatClientIdentity(row.secondClient).toLowerCase().includes(q) : false) ||
    (row.car ? `${row.car.brand} ${row.car.model}`.toLowerCase().includes(q) : false) ||
    (row.car ? row.car.registrationNumber.toLowerCase().includes(q) : false)
  );
}

// Main component

export function ContractPreview() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [selected, setSelected] = useState<Contract | null>(null);
  const [printRequested, setPrintRequested] = useState(false);
  const [archiveContract, setArchiveContract] = useState<Contract | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const { showToast } = useToast();

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | DisplayStatus>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [carFilter, setCarFilter] = useState<number>(0);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => readStoredPageSize(contractsPageSizeKey));

  useEffect(() => {
    void reload();
  }, []);

  useEffect(() => {
    if (!selected || !printRequested) return;

    const printTimer = window.setTimeout(() => {
      window.print();
      setPrintRequested(false);
    }, 100);

    return () => window.clearTimeout(printTimer);
  }, [printRequested, selected]);

  async function reload() {
    const [c, r, cl, ca] = await Promise.all([getContracts(), getReservations(), getClients(), getCars()]);
    setContracts(c);
    setReservations(r);
    setClients(cl);
    setCars(ca);
  }

  const reservationMap = useMemo(() => new Map(reservations.map((r) => [r.id, r])), [reservations]);
  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const carMap = useMemo(() => new Map(cars.map((c) => [c.id, c])), [cars]);
  const carFilterOptions = useMemo(
    () => [
      { value: 0, label: "Toutes les voitures" },
      ...cars.map((car) => ({
        keywords: `${car.brand} ${car.model} ${car.registrationNumber} ${formatRegistrationNumber(car.registrationNumber)}`,
        label: `${formatCarName(car.brand, car.model)} (${formatRegistrationNumber(car.registrationNumber)})`,
        value: car.id,
      })),
    ],
    [cars],
  );

  const rows = useMemo<ContractRow[]>(() =>
    contracts.map((contract) => {
      const reservation = reservationMap.get(contract.reservationId);
      const client = reservation ? clientMap.get(reservation.clientId) : undefined;
      const car = reservation ? carMap.get(reservation.carId) : undefined;
      const secondClient = reservation?.secondClientId ? clientMap.get(reservation.secondClientId) : undefined;
      const displayStatus = computeDisplayStatus(contract, reservation);
      const durationDays = reservation ? Math.max(1, getRentalDays(reservation.startDate, reservation.endDate)) : 0;
      return { car, client, contract, displayStatus, durationDays, reservation, secondClient };
    }),
  [carMap, clientMap, contracts, reservationMap]);

  // Stats
  const { cur: curMonth, prev: prevMonth } = currentAndPrevMonthKeys();
  const stats = useMemo(() => {
    const forMonth = (mk: string) => rows.filter((r) => monthKey(r.contract.generatedAt) === mk);
    const cur = forMonth(curMonth);
    const prev = forMonth(prevMonth);
    const count = (rows: ContractRow[], ds: DisplayStatus) => rows.filter((r) => r.displayStatus === ds).length;
    return {
      total: { cur: rows.length, prev: prev.length, curMonth: cur.length, prevMonth: prev.length },
      signed: { cur: count(rows, "SIGNED"), prev: count(forMonth(prevMonth), "SIGNED") },
      pending: { cur: count(rows, "PENDING") + count(rows, "GENERATED"), prev: count(forMonth(prevMonth), "PENDING") + count(forMonth(prevMonth), "GENERATED") },
      expired: { cur: count(rows, "EXPIRED"), prev: count(forMonth(prevMonth), "EXPIRED") },
    };
  }, [rows, curMonth, prevMonth]);

  // Filtered rows
  const filteredRows = useMemo(() =>
    rows.filter((row) => {
      if (!searchMatch(row, search)) return false;
      if (statusFilter !== "ALL" && row.displayStatus !== statusFilter) return false;
      if (dateFrom && row.contract.generatedAt.slice(0, 10) < dateFrom) return false;
      if (dateTo && row.contract.generatedAt.slice(0, 10) > dateTo) return false;
      if (carFilter !== 0 && row.reservation?.carId !== carFilter) return false;
      return true;
    }),
  [rows, search, statusFilter, dateFrom, dateTo, carFilter]);

  // Paginated rows
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  function handlePageSizeChange(nextPageSize: number) {
    setPageSize(nextPageSize);
    writeStoredPageSize(contractsPageSizeKey, nextPageSize);
    setPage(1);
  }

  function resetFilters() {
    setSearch(""); setStatusFilter("ALL"); setDateFrom(""); setDateTo(""); setCarFilter(0); setPage(1);
  }

  function printContract(contract: Contract) {
    setSelected(contract);
    setPrintRequested(true);
  }

  async function downloadContract(row: ContractRow) {
    try {
      const bytes = await createContractPdf(row.contract, {
        car: row.car, client: row.client, reservation: row.reservation, secondClient: row.secondClient,
      });
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${row.contract.contractNumber}.pdf`; a.click();
      URL.revokeObjectURL(url);
      showToast({ title: "Contrat téléchargé", type: "success" });
    } catch (error) {
      showToast({ message: getErrorMessage(error), title: "Erreur contrat", type: "error" });
    }
  }

  async function handleArchiveContract(reason?: string) {
    if (!archiveContract) return;
    try {
      setArchiveLoading(true);
      await archiveItem({ id: archiveContract.id, reason, type: "contract" });
      setArchiveContract(null);
      await reload();
      showToast({ title: "Contrat archivé avec succès", type: "success" });
    } catch (error) {
      showToast({ message: getErrorMessage(error), title: "Impossible d'archiver cet élément", type: "error" });
    } finally {
      setArchiveLoading(false);
    }
  }

  const dialogReservation = selected ? reservationMap.get(selected.reservationId) : undefined;
  const dialogClient = dialogReservation ? clientMap.get(dialogReservation.clientId) : undefined;
  const dialogSecondClient = dialogReservation?.secondClientId ? clientMap.get(dialogReservation.secondClientId) : undefined;
  const dialogCar = dialogReservation ? carMap.get(dialogReservation.carId) : undefined;

  return (
    <>
      <PageHeader title="Contrats">
        <div className="flex flex-wrap items-center gap-2">
          <p className="hidden text-sm text-muted-foreground md:block">
            Gérez et consultez tous vos contrats de location
          </p>
          <Button type="button" variant="outline" onClick={() => showToast({ title: "Export en cours...", type: "success" })}>
            <Download className="h-4 w-4" />
            Exporter PDF
          </Button>
          <Button asChild type="button">
            <Link to="/reservations">
              <Plus className="h-4 w-4" />
              Nouveau contrat
            </Link>
          </Button>
        </div>
      </PageHeader>

      {/* Stats cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          color="blue"
          icon={<FileText className="h-5 w-5" />}
          label="Total contrats"
          sub={`Ce mois ${trendLabel(stats.total.curMonth, stats.total.prevMonth) ?? ""}`}
          subPositive={stats.total.curMonth >= stats.total.prevMonth}
          value={rows.length}
        />
        <StatCard
          color="emerald"
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Contrats signés"
          sub={`Ce mois ${trendLabel(stats.signed.cur, stats.signed.prev) ?? ""}`}
          subPositive={stats.signed.cur >= stats.signed.prev}
          value={stats.signed.cur}
        />
        <StatCard
          color="orange"
          icon={<Clock className="h-5 w-5" />}
          label="En attente"
          sub={`Ce mois ${trendLabel(stats.pending.cur, stats.pending.prev) ?? ""}`}
          subPositive={false}
          value={stats.pending.cur}
        />
        <StatCard
          color="red"
          icon={<XCircle className="h-5 w-5" />}
          label="Expirés"
          sub={`Ce mois ${trendLabel(stats.expired.cur, stats.expired.prev) ?? ""}`}
          subPositive={false}
          value={stats.expired.cur}
        />
      </div>

      {/* Filter bar */}
      <div className="mb-5 flex flex-wrap items-end gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-9 w-64 rounded-md border border-border bg-white pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring dark:bg-slate-900"
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Rechercher (client, voiture, n° contrat...)"
            type="text"
            value={search}
          />
        </div>

        <SearchableSelect
          ariaLabel="Filtrer par statut de contrat"
          className="h-9 rounded-md dark:bg-slate-900"
          onValueChange={(nextValue) => { setStatusFilter(nextValue as "ALL" | DisplayStatus); setPage(1); }}
          options={contractStatusFilterOptions}
          value={statusFilter}
        />

        <div className="flex items-center gap-1">
          <span className="text-sm text-muted-foreground">Date du</span>
          <input
            className="h-9 rounded-md border border-border bg-white px-3 text-sm dark:bg-slate-900"
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            type="date"
            value={dateFrom}
          />
        </div>

        <div className="flex items-center gap-1">
          <span className="text-sm text-muted-foreground">Date au</span>
          <input
            className="h-9 rounded-md border border-border bg-white px-3 text-sm dark:bg-slate-900"
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            type="date"
            value={dateTo}
          />
        </div>

        <SearchableSelect
          ariaLabel="Filtrer par voiture"
          className="h-9 rounded-md dark:bg-slate-900"
          onValueChange={(nextValue) => { setCarFilter(Number(nextValue)); setPage(1); }}
          options={carFilterOptions}
          searchPlaceholder="Rechercher une voiture..."
          value={carFilter}
        />

        <Button onClick={resetFilters} size="sm" type="button" variant="ghost">
          <RotateCcw className="h-3.5 w-3.5" />
          Réinitialiser
        </Button>
      </div>

      {/* Table */}
      <Card className="overflow-hidden p-0 dark:bg-slate-900 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-50 dark:bg-slate-950">
                {["N° CONTRAT", "CLIENT", "VOITURE", "PÉRIODE", "STATUT", "GÉNÉRÉ LE", "SIGNATURE", "ACTIONS"].map((h) => (
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground" key={h}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-center text-sm text-muted-foreground" colSpan={8}>
                    Aucun contrat trouvé.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row) => (
                  <ContractTableRow
                    key={row.contract.id}
                    onDownload={() => void downloadContract(row)}
                    onArchive={() => setArchiveContract(row.contract)}
                    onPrint={() => printContract(row.contract)}
                    onView={() => setSelected(row.contract)}
                    row={row}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        <AppPagination
          currentPage={safePage}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
          pageSize={pageSize}
          totalItems={filteredRows.length}
          totalPages={totalPages}
        />
      </Card>

      {/* Preview dialog */}
      <Dialog onOpenChange={(v) => !v && setSelected(null)} open={Boolean(selected)}>
        <DialogContent className="contract-print-dialog max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Prévisualisation contrat</DialogTitle>
          </DialogHeader>
          {selected && (
            <ContractPDF
              car={dialogCar}
              client={dialogClient}
              contract={selected}
              reservation={dialogReservation}
              secondClient={dialogSecondClient}
            />
          )}
        </DialogContent>
      </Dialog>

      <ArchiveConfirmDialog
        itemTitle={archiveContract?.contractNumber ?? "Contrat"}
        itemType="contract"
        loading={archiveLoading}
        onCancel={() => !archiveLoading && setArchiveContract(null)}
        onConfirm={(reason) => void handleArchiveContract(reason)}
        open={Boolean(archiveContract)}
      />
    </>
  );
}

// Stat card

function StatCard({
  color,
  icon,
  label,
  sub,
  subPositive,
  value,
}: {
  color: "blue" | "emerald" | "orange" | "red";
  icon: React.ReactNode;
  label: string;
  sub: string;
  subPositive: boolean;
  value: number;
}) {
  const iconStyle = {
    blue: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300",
    emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
    orange: "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300",
    red: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300",
  }[color];

  return (
    <Card className="dark:bg-slate-900 dark:border-slate-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-3xl font-bold text-foreground">{value}</p>
          <p className={cn("mt-1 text-xs font-medium", subPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400")}>
            {sub}
          </p>
        </div>
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", iconStyle)}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

// Table row

function ContractTableRow({
  onArchive,
  onDownload,
  onPrint,
  onView,
  row,
}: {
  onArchive: () => void;
  onDownload: () => void;
  onPrint: () => void;
  onView: () => void;
  row: ContractRow;
}) {
  const period = formatPeriodLines(row.reservation);
  const generated = formatDateLine(row.contract.generatedAt);
  const signature = row.contract.status === "SIGNED" ? formatDateLine(row.contract.signedAt) : null;

  return (
    <tr className="border-b border-border last:border-0 transition hover:bg-slate-50/60 dark:hover:bg-slate-950/40">
      {/* N° Contrat */}
      <td className="px-4 py-3">
        <span className="font-mono text-sm font-semibold text-foreground">{row.contract.contractNumber}</span>
      </td>

      {/* Client */}
      <td className="px-4 py-3">
        {row.client ? (
          <div className="flex items-center gap-3">
            <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white", avatarColor(row.client.id))}>
              {clientInitials(normalizeClientName(row.client.fullName))}
            </div>
            <div>
              <p className="font-semibold text-foreground">{normalizeClientName(row.client.fullName)}</p>
              <p className="text-xs text-muted-foreground">
                {row.client.cin ? `CIN : ${row.client.cin}` : row.client.passportNumber ? `Passeport : ${row.client.passportNumber}` : ""}
              </p>
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </td>

      {/* Voiture */}
      <td className="px-4 py-3">
        {row.car ? (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-800">
              <CarIcon className="h-4 w-4" />
            </div>
            <div>
              <p className="font-medium text-foreground">{formatCarName(row.car.brand, row.car.model)}</p>
              <p className="text-xs text-muted-foreground">{formatRegistrationNumber(row.car.registrationNumber)}</p>
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </td>

      {/* Période */}
      <td className="px-4 py-3">
        {row.reservation ? (
          <div className="text-sm">
            <p className="text-foreground">{period.start} -</p>
            <p className="text-foreground">{period.end}</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarDays className="h-3 w-3" />
              {period.duration}
            </p>
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </td>

      {/* Statut */}
      <td className="px-4 py-3">
        <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", getDisplayStatusStyle(row.displayStatus))}>
          {getDisplayStatusLabel(row.displayStatus)}
        </span>
      </td>

      {/* Généré le */}
      <td className="px-4 py-3">
        <p className="text-sm text-foreground">{generated.date}</p>
        {generated.time && <p className="text-xs text-muted-foreground">{generated.time}</p>}
      </td>

      {/* Signature */}
      <td className="px-4 py-3">
        {signature ? (
          <>
            <p className="text-sm text-foreground">{signature.date}</p>
            {signature.time && <p className="text-xs text-muted-foreground">{signature.time}</p>}
          </>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <ActionIconButton color="blue" icon={Eye} label="Voir contrat" onClick={onView} />
          <ActionIconButton color="emerald" icon={Download} label="Télécharger" onClick={onDownload} />
          <ActionIconButton color="slate" icon={Printer} label="Imprimer" onClick={onPrint} />
          <ActionIconButton color="violet" icon={Archive} label="Archiver" onClick={onArchive} />
        </div>
      </td>
    </tr>
  );
}

function getErrorMessage(caught: unknown) {
  return caught instanceof Error ? caught.message : String(caught);
}
