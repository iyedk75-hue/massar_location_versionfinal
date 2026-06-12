import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Banknote,
  CalendarDays,
  Car as CarIcon,
  Eye,
  Plus,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/app/layout";
import { DataGridActionMenu } from "@/components/ui/action-menu/DataGridActionMenu";
import { AppPagination } from "@/components/ui/pagination/AppPagination";
import { ArchiveConfirmDialog } from "@/components/archive/ArchiveConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { DepositAnalyticsDialog } from "@/pages/payments/DepositAnalyticsDialog";
import { PaymentForm } from "@/pages/payments/PaymentForm";
import { archiveItem } from "@/services/archiveService";
import { getCars } from "@/services/car.service";
import { getClients } from "@/services/client.service";
import { createPayment, getPayments } from "@/services/payment.service";
import { getReservations } from "@/services/reservation.service";
import type { Car } from "@/types/car";
import type { Client } from "@/types/client";
import type { CreatePaymentDto, Payment, PaymentType } from "@/types/payment";
import type { Reservation } from "@/types/reservation";
import { cn } from "@/lib/utils";
import { formatCarName, formatRegistrationNumber } from "@/utils/car";
import { formatClientIdentity, normalizeClientName } from "@/utils/client";
import { formatShortPeriod, getLocalDateKey, getRentalDays } from "@/utils/date";
import { formatMoney } from "@/utils/money";
import { useToast } from "@/hooks/useToast";
import { useConfirmAction } from "@/hooks/useConfirmAction";
import { readStoredPageSize, writeStoredPageSize } from "@/lib/pagination";

type PaymentStatus = "Non payé" | "Partiel" | "Payé" | "Annulée";
type DepositStatus = "Non versée" | "Bloquée" | "Remboursée" | "Retenue";

type ReservationSummary = {
  car?: Car;
  client?: Client;
  depositAmount: number;
  depositPaid: number;
  depositRefundDecided: boolean;
  depositRefunded: number;
  depositStatus: DepositStatus;
  latestPayment?: Payment;
  paid: number;
  remaining: number;
  reservation: Reservation;
  secondClient?: Client;
  status: PaymentStatus;
};

const paymentsPageSizeKey = "massar-pagination-page-size-payments";
const paymentStatusFilterOptions = [
  { value: "ALL", label: "Tous les statuts" },
  { value: "Payé", label: "Payé" },
  { value: "Partiel", label: "Partiel" },
  { value: "Non payé", label: "Non payé" },
  { value: "Annulée", label: "Annulée" },
];

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-rose-500",
];

export function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [reservationFilter, setReservationFilter] = useState<number>(0);
  const [statusFilter, setStatusFilter] = useState<"ALL" | PaymentStatus>("ALL");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(() => readStoredPageSize(paymentsPageSizeKey));
  const [open, setOpen] = useState(false);
  const [actionSummary, setActionSummary] = useState<ReservationSummary | null>(null);
  const [archivePayment, setArchivePayment] = useState<Payment | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [depositAnalyticsOpen, setDepositAnalyticsOpen] = useState(false);
  const { confirmAction } = useConfirmAction();
  const { showToast } = useToast();

  useEffect(() => {
    void reload();
  }, []);

  async function reload() {
    const [paymentsData, reservationsData, clientsData, carsData] = await Promise.all([
      getPayments(),
      getReservations(),
      getClients(),
      getCars(),
    ]);
    setPayments(paymentsData);
    setReservations(reservationsData);
    setClients(clientsData);
    setCars(carsData);
  }

  const clientsById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const carsById = useMemo(() => new Map(cars.map((car) => [car.id, car])), [cars]);
  const summaries = useMemo(
    () =>
      reservations.map((reservation): ReservationSummary => {
        const reservationPayments = payments.filter((payment) => payment.reservationId === reservation.id);
        const depositPaid = sumPayments(reservationPayments, "DEPOSIT");
        const depositRefunded = sumPayments(reservationPayments, "DEPOSIT_REFUND");
        const depositRefundDecided = reservationPayments.some((payment) => payment.type === "DEPOSIT_REFUND");
        const depositAmount = reservation.depositAmount || depositPaid;
        const paid = sumPayments(reservationPayments, "RENTAL_PAYMENT");
        const latestPayment = [...reservationPayments].sort(
          (first, second) => new Date(second.paymentDate).getTime() - new Date(first.paymentDate).getTime(),
        )[0];
        const remaining = Math.max(0, reservation.totalPrice - paid);
        const status =
          reservation.status === "CANCELLED" ? "Annulée" : paid <= 0 ? "Non payé" : remaining > 0 ? "Partiel" : "Payé";

        return {
          car: carsById.get(reservation.carId),
          client: clientsById.get(reservation.clientId),
          depositAmount,
          depositPaid,
          depositRefundDecided,
          depositRefunded,
          depositStatus: getDepositStatus(depositAmount, depositPaid, depositRefunded, depositRefundDecided),
          latestPayment,
          paid,
          remaining,
          reservation,
          secondClient: reservation.secondClientId ? clientsById.get(reservation.secondClientId) : undefined,
          status,
        };
      }),
    [carsById, clientsById, payments, reservations],
  );

  const filteredSummaries = useMemo(
    () =>
      summaries
        .filter((summary) => reservationFilter === 0 || summary.reservation.id === reservationFilter)
        .filter((summary) => statusFilter === "ALL" || summary.status === statusFilter)
        .filter((summary) => reservationOverlapsPeriod(summary.reservation, periodFrom, periodTo))
        .sort((first, second) => second.remaining - first.remaining),
    [periodFrom, periodTo, reservationFilter, statusFilter, summaries],
  );
  const reservationFilterOptions = useMemo(
    () => [
      { value: 0, label: "Toutes les réservations" },
      ...summaries.map((summary) => ({
        keywords: `${summary.reservation.id} ${summary.client?.fullName ?? ""} ${summary.client?.cin ?? ""} ${
          summary.client?.passportNumber ?? ""
        } ${summary.secondClient?.fullName ?? ""} ${summary.secondClient?.cin ?? ""} ${
          summary.secondClient?.passportNumber ?? ""
        } ${summary.car?.registrationNumber ?? ""}`,
        label: getReservationLabel(summary),
        value: summary.reservation.id,
      })),
    ],
    [summaries],
  );

  const totalPages = Math.max(1, Math.ceil(filteredSummaries.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedSummaries = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * itemsPerPage;
    return filteredSummaries.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredSummaries, itemsPerPage, safeCurrentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [periodFrom, periodTo, reservationFilter, statusFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  function handlePageSizeChange(nextItemsPerPage: number) {
    setItemsPerPage(nextItemsPerPage);
    writeStoredPageSize(paymentsPageSizeKey, nextItemsPerPage);
    setCurrentPage(1);
  }

  function resetFilters() {
    setReservationFilter(0);
    setStatusFilter("ALL");
    setPeriodFrom("");
    setPeriodTo("");
    setCurrentPage(1);
  }

  const totals = useMemo(() => {
    const payableSummaries = filteredSummaries.filter((summary) => summary.reservation.status !== "CANCELLED");
    const totalDue = payableSummaries.reduce((sum, summary) => sum + summary.reservation.totalPrice, 0);
    const totalPaid = payableSummaries.reduce((sum, summary) => sum + summary.paid, 0);
    const depositPaid = filteredSummaries.reduce((sum, summary) => sum + summary.depositPaid, 0);
    const depositRefunded = filteredSummaries.reduce((sum, summary) => sum + summary.depositRefunded, 0);

    return {
      depositPaid: Math.max(0, depositPaid - depositRefunded),
      depositRefunded,
      remaining: Math.max(0, totalDue - totalPaid),
      totalDue,
      totalPaid,
    };
  }, [filteredSummaries]);

  async function handleCreate(data: CreatePaymentDto) {
    try {
      const payment = await createPayment(data);
      setPayments((current) => [payment, ...current]);
      setOpen(false);
      setActionSummary(null);
      showToast({ title: "Paiement ajouté", type: "success" });
    } catch (caught) {
      showToast({ message: getErrorMessage(caught), title: "Erreur paiement", type: "error" });
    }
  }

  async function handleArchivePayment(reason?: string) {
    if (!archivePayment) return;
    try {
      setArchiveLoading(true);
      await archiveItem({ id: archivePayment.id, reason, type: "payment" });
      setArchivePayment(null);
      await reload();
      showToast({ title: "Paiement archivé avec succès", type: "success" });
    } catch (caught) {
      showToast({ message: getErrorMessage(caught), title: "Impossible d'archiver cet élément", type: "error" });
    } finally {
      setArchiveLoading(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader title="Paiements">
        <Dialog onOpenChange={setOpen} open={open}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Ajouter paiement
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter un paiement</DialogTitle>
            </DialogHeader>
            <PaymentForm cars={cars} clients={clients} onSubmit={handleCreate} payments={payments} reservations={reservations} />
          </DialogContent>
        </Dialog>
      </PageHeader>

      <StatsGrid onDepositDetails={() => setDepositAnalyticsOpen(true)} totals={totals} />

      <section className="grid gap-4 rounded-lg border border-border bg-white p-4 shadow-sm xl:grid-cols-[1fr_1fr_1fr_auto]">
        <FilterField label="Filtrer par réservation">
          <SearchableSelect
            ariaLabel="Filtrer par réservation"
            onValueChange={(nextValue) => setReservationFilter(Number(nextValue))}
            options={reservationFilterOptions}
            searchPlaceholder="Rechercher une réservation..."
            value={reservationFilter}
          />
        </FilterField>

        <FilterField label="Statut de paiement">
          <SearchableSelect
            ariaLabel="Filtrer par statut de paiement"
            onValueChange={(nextValue) => setStatusFilter(nextValue as "ALL" | PaymentStatus)}
            options={paymentStatusFilterOptions}
            value={statusFilter}
          />
        </FilterField>

        <FilterField label="Période">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Date de début"
                className="pl-10"
                max={periodTo || undefined}
                onChange={(event) => setPeriodFrom(event.target.value)}
                type="date"
                value={periodFrom}
              />
            </div>
            <span className="hidden text-sm text-muted-foreground sm:inline">→</span>
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Date de fin"
                className="pl-10"
                min={periodFrom || undefined}
                onChange={(event) => setPeriodTo(event.target.value)}
                type="date"
                value={periodTo}
              />
            </div>
          </div>
        </FilterField>

        <div className="flex items-end">
          <Button
            className="h-12 w-full rounded-xl border-slate-200 bg-slate-100 px-5 text-slate-800 shadow-sm hover:bg-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 xl:w-auto"
            onClick={resetFilters}
            type="button"
            variant="outline"
          >
            <RotateCcw className="h-4 w-4" />
            Réinitialiser
          </Button>
        </div>
      </section>

      <Card className="overflow-hidden p-0 dark:bg-slate-900 dark:border-slate-800">
        <PaymentsDataGrid
          onArchivePayment={(payment) =>
            confirmAction({
              action: "archiver",
              confirmLabel: "Archiver",
              description: `Le paiement #${payment.id} sera déplacé dans les archives.`,
              title: "Archiver ce paiement ?",
              onConfirm: () => setArchivePayment(payment),
            })
          }
          onPaymentAction={setActionSummary}
          rows={paginatedSummaries}
        />
        <AppPagination
          currentPage={safeCurrentPage}
          onPageChange={setCurrentPage}
          onPageSizeChange={handlePageSizeChange}
          pageSize={itemsPerPage}
          totalItems={filteredSummaries.length}
          totalPages={totalPages}
        />
      </Card>

      <Dialog onOpenChange={(nextOpen) => !nextOpen && setActionSummary(null)} open={Boolean(actionSummary)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Action paiement</DialogTitle>
          </DialogHeader>
          {actionSummary && (
            <PaymentForm
              cars={cars}
              clients={clients}
              initialReservationId={actionSummary.reservation.id}
              initialType={getNextPaymentType(actionSummary)}
              lockReservation
              onSubmit={handleCreate}
              payments={payments}
              reservations={reservations}
            />
          )}
        </DialogContent>
      </Dialog>

      <DepositAnalyticsDialog
        cars={cars}
        clients={clients}
        onOpenChange={setDepositAnalyticsOpen}
        onRefund={(reservationId) => {
          const summary = summaries.find((item) => item.reservation.id === reservationId);
          if (!summary) return;
          setDepositAnalyticsOpen(false);
          setActionSummary(summary);
        }}
        open={depositAnalyticsOpen}
        payments={payments}
        reservations={reservations}
      />

      <ArchiveConfirmDialog
        itemTitle={archivePayment ? `Paiement #${archivePayment.id}` : "Paiement"}
        itemType="payment"
        loading={archiveLoading}
        onCancel={() => !archiveLoading && setArchivePayment(null)}
        onConfirm={(reason) => void handleArchivePayment(reason)}
        open={Boolean(archivePayment)}
      />
    </div>
  );
}

function StatsGrid({
  onDepositDetails,
  totals,
}: {
  onDepositDetails: () => void;
  totals: { depositPaid: number; depositRefunded: number; remaining: number; totalDue: number; totalPaid: number };
}) {
  return (
    <section className="grid grid-cols-5 gap-4">
      <StatCard
        description="Somme de toutes les réservations"
        icon={CalendarDays}
        label="Total à payer"
        tone="blue"
        value={formatMoney(totals.remaining)}
      />
      <StatCard
        description="Somme des paiements reçus"
        icon={Banknote}
        label="Total payé"
        tone="green"
        value={formatMoney(totals.totalPaid)}
      />
      <StatCard
        description="Montant restant à encaisser"
        icon={ReceiptText}
        label="Reste à payer"
        tone="orange"
        value={formatMoney(totals.remaining)}
      />
      <StatCard
        description="Cautions actuellement versées"
        icon={ShieldCheck}
        label="Caution versée"
        onClick={onDepositDetails}
        tone="purple"
        value={formatMoney(totals.depositPaid)}
      />
      <StatCard
        description="Cautions déjà remboursées"
        icon={RotateCcw}
        label="Caution remboursée"
        tone="green"
        value={formatMoney(totals.depositRefunded)}
      />
    </section>
  );
}

function StatCard({
  icon: Icon,
  description,
  label,
  onClick,
  tone,
  value,
}: {
  description: string;
  icon: typeof Banknote;
  label: string;
  onClick?: () => void;
  tone: "blue" | "green" | "orange" | "purple";
  value: string;
}) {
  const tones = {
    blue: "border-blue-200 bg-blue-50/40 text-blue-700",
    green: "border-emerald-200 bg-emerald-50/40 text-emerald-700",
    orange: "border-amber-200 bg-amber-50/50 text-amber-700",
    purple: "border-violet-200 bg-violet-50/40 text-violet-700",
  };

  return (
    <article
      className={cn(
        "min-h-[112px] rounded-lg border bg-white p-4 shadow-sm transition-smooth hover:-translate-y-0.5 hover:shadow-md",
        onClick && "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        tones[tone],
      )}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/80">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground/75">{label}</p>
          <p className="mt-1 truncate text-2xl font-semibold text-foreground">{value}</p>
        </div>
      </div>
      <p className="mt-3 truncate text-xs font-medium text-muted-foreground">{description}</p>
    </article>
  );
}

function FilterField({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function PaymentsDataGrid({
  onArchivePayment,
  onPaymentAction,
  rows,
}: {
  onArchivePayment: (payment: Payment) => void;
  onPaymentAction: (summary: ReservationSummary) => void;
  rows: ReservationSummary[];
}) {
  return (
    <div className="w-full overflow-x-auto md:overflow-x-visible">
      <table className="w-full min-w-[1040px] table-fixed text-sm md:min-w-0" role="grid">
        <thead>
          <tr className="border-b border-border bg-slate-50 dark:bg-slate-950">
            <th className="min-w-0 px-2 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Client</th>
            <th className="min-w-0 px-2 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Voiture</th>
            <th className="w-[126px] px-2 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:w-[146px]">Période</th>
            <th className="w-[86px] px-2 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:w-[102px]">Dû</th>
            <th className="w-[86px] px-2 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:w-[102px]">Payé</th>
            <th className="w-[86px] px-2 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:w-[102px]">Reste</th>
            <th className="w-[112px] px-2 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:w-[132px]">Caution</th>
            <th className="w-[96px] px-2 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:w-[118px]">Statut</th>
            <th className="w-[154px] px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:w-[176px]">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-4 py-10 text-center text-sm text-muted-foreground" colSpan={9}>
                Aucun résumé de paiement trouvé
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const actionLocked = isPaymentActionLocked(row);

              return (
                <tr
                  className="border-b border-border last:border-0 transition hover:bg-slate-50/60 dark:hover:bg-slate-950/40"
                  key={row.reservation.id}
                >
                  <td className="min-w-0 overflow-hidden px-2 py-3">
                    <ClientCell client={row.client} />
                  </td>
                  <td className="min-w-0 overflow-hidden px-2 py-3">
                    <CarCell car={row.car} />
                  </td>
                  <td className="overflow-hidden px-2 py-3">
                    <PeriodCell reservation={row.reservation} />
                  </td>
                  <td className="overflow-hidden whitespace-nowrap px-2 py-3 font-semibold">
                    <span className="block truncate">{formatMoney(row.reservation.totalPrice)}</span>
                  </td>
                  <td className="overflow-hidden whitespace-nowrap px-2 py-3 font-semibold text-emerald-700 dark:text-emerald-300">
                    <span className="block truncate">{formatMoney(row.paid)}</span>
                  </td>
                  <td className={cn("overflow-hidden whitespace-nowrap px-2 py-3 font-semibold", row.remaining > 0 ? "text-red-600 dark:text-red-300" : "text-foreground")}>
                    <span className="block truncate">{formatMoney(row.remaining)}</span>
                  </td>
                  <td className="overflow-hidden px-2 py-3">
                    <DepositBadge summary={row} />
                  </td>
                  <td className="overflow-hidden px-2 py-3">
                    <PaymentStatus label={row.status} />
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex justify-end">
                      <DataGridActionMenu
                        actions={[
                          {
                            disabled: actionLocked,
                            icon: Banknote,
                            label: actionLocked ? "Paiement terminé" : "Ajouter une action paiement",
                            onClick: () => onPaymentAction(row),
                          },
                          ...(row.latestPayment
                            ? [
                                { href: `/payments/${row.latestPayment.id}`, icon: Eye, label: "Voir détail" },
                                { icon: ReceiptText, label: "Reçu" },
                                { icon: Archive, label: "Archiver", onClick: () => onArchivePayment(row.latestPayment!) },
                              ]
                            : [{ disabled: true, icon: Eye, label: "Aucun paiement renseigné" }]),
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function ClientCell({ client }: { client?: Client }) {
  if (!client) return <span className="text-muted-foreground">Client inconnu</span>;

  const name = normalizeClientName(client.fullName);

  return (
    <div className="flex min-w-0 items-center gap-2 lg:gap-3">
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white", avatarColor(client.id))}>
        {clientInitials(name)}
      </div>
      <div className="min-w-0">
        <p className="truncate font-semibold text-foreground">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{getClientIdentifier(client)}</p>
      </div>
    </div>
  );
}

function CarCell({ car }: { car?: Car }) {
  if (!car) return <span className="text-muted-foreground">Voiture inconnue</span>;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-800">
        <CarIcon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{formatCarName(car.brand, car.model)}</p>
        <p className="truncate text-xs text-muted-foreground">{formatRegistrationNumber(car.registrationNumber)}</p>
      </div>
    </div>
  );
}

function PeriodCell({ reservation }: { reservation: Reservation }) {
  const period = formatPaymentPeriodLines(reservation);

  return (
    <div className="text-sm">
      <p className="truncate text-foreground">{period.start} -</p>
      <p className="truncate text-foreground">{period.end}</p>
      <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
        <CalendarDays className="h-3 w-3 shrink-0" />
        <span className="truncate">{period.duration}</span>
      </p>
    </div>
  );
}

function formatPaymentPeriodLines(reservation: Reservation) {
  const fmt = (value: string) =>
    new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  const days = Math.max(1, getRentalDays(reservation.startDate, reservation.endDate));

  return {
    duration: `${days} jour${days > 1 ? "s" : ""}`,
    end: fmt(reservation.endDate),
    start: fmt(reservation.startDate),
  };
}

function clientInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function avatarColor(id: number) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

function PaymentStatus({ label }: { label: PaymentStatus }) {
  const className =
    label === "Payé"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
      : label === "Partiel"
        ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
        : label === "Annulée"
          ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
          : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";

  return (
    <span className={cn("inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-xs font-semibold", className)}>
      <span className="truncate">{label}</span>
    </span>
  );
}

function DepositBadge({ summary }: { summary: ReservationSummary }) {
  const className =
    summary.depositStatus === "Remboursée"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
      : summary.depositStatus === "Retenue"
        ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
        : summary.depositStatus === "Bloquée"
          ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";

  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <span className={cn("inline-flex max-w-full rounded-full px-2 py-0.5 text-xs font-semibold", className)}>
        <span className="truncate">{formatMoney(summary.depositAmount)}</span>
      </span>
      <span className="max-w-full truncate text-xs font-medium text-muted-foreground">{summary.depositStatus}</span>
    </div>
  );
}

function sumPayments(payments: Payment[], type: Payment["type"]) {
  return payments.filter((payment) => payment.type === type).reduce((sum, payment) => sum + payment.amount, 0);
}

function getDepositStatus(depositAmount: number, depositPaid: number, depositRefunded: number, depositRefundDecided: boolean): DepositStatus {
  if (depositPaid <= 0) return "Non versée";
  const refundableDeposit = getRefundableDeposit(depositAmount, depositPaid);
  if (refundableDeposit > 0 && depositRefunded >= refundableDeposit) return "Remboursée";
  if (depositRefundDecided && depositRefunded < refundableDeposit) return "Retenue";
  return "Bloquée";
}

function isPaymentActionLocked(summary: ReservationSummary) {
  const rentalClosed = summary.remaining <= 0;
  const refundableDeposit = getRefundableDeposit(summary.depositAmount, summary.depositPaid);
  const depositClosed = refundableDeposit > 0 ? summary.depositRefundDecided : summary.depositAmount <= 0;
  return rentalClosed && depositClosed;
}

function getNextPaymentType(summary: ReservationSummary): PaymentType {
  if (summary.remaining > 0) return "RENTAL_PAYMENT";

  const depositAvailable = Math.max(0, getRefundableDeposit(summary.depositAmount, summary.depositPaid) - summary.depositRefunded);
  if (depositAvailable > 0 && !summary.depositRefundDecided) return "DEPOSIT_REFUND";
  if (summary.depositPaid <= 0 && summary.depositAmount > 0) return "DEPOSIT";

  return "PENALTY";
}

function getRefundableDeposit(depositAmount: number, depositPaid: number) {
  if (depositPaid <= 0) return 0;
  return depositAmount > 0 ? Math.min(depositPaid, depositAmount) : depositPaid;
}

function getReservationLabel(summary: ReservationSummary) {
  const client = summary.client ? `${normalizeClientName(summary.client.fullName)} (${formatClientIdentity(summary.client)})` : "Client inconnu";
  const secondClient = summary.secondClient
    ? ` / 2e conducteur: ${normalizeClientName(summary.secondClient.fullName)} (${formatClientIdentity(summary.secondClient)})`
    : "";
  return `${client}${secondClient} - ${formatSummaryCar(
    summary.car,
  )} - ${formatShortPeriod(summary.reservation.startDate, summary.reservation.endDate)}`;
}

function reservationOverlapsPeriod(reservation: Reservation, periodFrom: string, periodTo: string) {
  if (!periodFrom && !periodTo) return true;

  const reservationStart = getLocalDateKey(reservation.startDate);
  const reservationEnd = getLocalDateKey(reservation.endDate);
  const from = periodFrom || "0000-01-01";
  const to = periodTo || "9999-12-31";

  return reservationStart <= to && reservationEnd >= from;
}

function formatSummaryCar(car?: Car) {
  if (!car) return "Voiture inconnue";
  return `${formatCarName(car.brand, car.model)} (${formatRegistrationNumber(car.registrationNumber)})`;
}

function getClientIdentifier(client?: Client) {
  if (!client) return "Pièce : -";
  if (client.cin) return `CIN : ${client.cin}`;
  if (client.passportNumber) return `Passeport : ${client.passportNumber}`;
  return "Pièce : -";
}

function getErrorMessage(caught: unknown) {
  return caught instanceof Error ? caught.message : String(caught);
}
