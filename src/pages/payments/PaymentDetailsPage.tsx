import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  CarFront,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CreditCard,
  FileText,
  IdCard,
  Info,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { AppPagination } from "@/components/ui/pagination/AppPagination";
import { getCars } from "@/services/car.service";
import { getClients } from "@/services/client.service";
import { getPayments } from "@/services/payment.service";
import { getReservations } from "@/services/reservation.service";
import type { Car } from "@/types/car";
import type { Client } from "@/types/client";
import type { Payment, PaymentMethod, PaymentType } from "@/types/payment";
import type { Reservation } from "@/types/reservation";
import { cn } from "@/lib/utils";
import { formatCarName, formatRegistrationNumber } from "@/utils/car";
import { normalizeClientName } from "@/utils/client";
import { formatDateTime } from "@/utils/date";
import { formatMoney } from "@/utils/money";
import { readStoredPageSize, writeStoredPageSize } from "@/lib/pagination";

type PaymentStatus = "Payé" | "Partiel" | "Non payé";
type DepositStatus = "Non versée" | "Bloquée" | "Remboursée" | "Retenue";

type PaymentDetailData = {
  client: {
    cin: string;
    name: string;
  };
  deposit: {
    amount: number;
    conditions: string | null;
    method: string | null;
    paidAt: string | null;
    refundedAmount: number;
    refundedAt: string | null;
    refundMethod: string | null;
    retainedAmount: number;
    refundConditions: string[];
    status: DepositStatus;
    warning: string | null;
  };
  payment: {
    extraFees: number;
    remaining: number;
    rentalAmount: number;
    totalDue: number;
    totalPaid: number;
  };
  reservation: {
    carImageUrl: string | null;
    carName: string;
    days: number;
    endDate: string;
    paymentMethod: string;
    paymentStatus: PaymentStatus;
    registration: string;
    startDate: string;
  };
  transactions: Transaction[];
};

type Transaction = {
  amount: number;
  date: string;
  description: string;
  id: string;
  method: string;
  type: "Location" | "Caution" | "Remboursement" | "Pénalité";
};

const paymentDetailsPageSizeKey = "massar-pagination-page-size-payment-details";

export function PaymentDetailsPage() {
  const { paymentId } = useParams();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(Boolean(paymentId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentId) return;

    async function loadPaymentDetail() {
      try {
        setLoading(true);
        setError(null);
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
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        setLoading(false);
      }
    }

    void loadPaymentDetail();
  }, [paymentId]);

  const data = useMemo(() => {
    if (!paymentId) return null;
    return buildPaymentDetailData(Number(paymentId), payments, reservations, clients, cars);
  }, [cars, clients, paymentId, payments, reservations]);

  if (loading) {
    return <DesktopStateCard title="Chargement du paiement" description="Récupération des données depuis l'application Tauri." />;
  }

  if (error) {
    return <DesktopStateCard title="Paiement indisponible" description={error} />;
  }

  if (!paymentId) {
    return <DesktopStateCard title="Paiement indisponible" description="Aucun paiement n'a été sélectionné." />;
  }

  if (!data) {
    return <DesktopStateCard title="Paiement introuvable" description="Aucun paiement ne correspond à cet identifiant." />;
  }

  return (
    <div className="flex w-full flex-col gap-5">
      <Breadcrumb />

      <PaymentSummaryCard data={data} />

      <section className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
        <PaymentDetails payment={data.payment} status={data.reservation.paymentStatus} />
        <DepositDetails deposit={data.deposit} />
      </section>

      <TransactionsTable transactions={data.transactions} />
    </div>
  );
}

function DesktopStateCard({ description, title }: { description: string; title: string }) {
  return (
    <div className="flex h-full min-h-[420px] w-full items-center justify-center">
      <div className="rounded-lg border border-border bg-white px-6 py-5 text-center shadow-sm">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <Link className="mt-4 inline-flex text-sm font-semibold text-primary hover:text-primary/80" to="/payments">
          Retour aux paiements
        </Link>
      </div>
    </div>
  );
}

function buildPaymentDetailData(
  paymentId: number,
  payments: Payment[],
  reservations: Reservation[],
  clients: Client[],
  cars: Car[],
): PaymentDetailData | null {
  const selectedPayment = payments.find((payment) => payment.id === paymentId);
  if (!selectedPayment) return null;

  const reservation = reservations.find((item) => item.id === selectedPayment.reservationId);
  if (!reservation) return null;

  const client = clients.find((item) => item.id === reservation.clientId);
  const car = cars.find((item) => item.id === reservation.carId);
  const reservationPayments = payments
    .filter((payment) => payment.reservationId === reservation.id)
    .sort((first, second) => new Date(second.paymentDate).getTime() - new Date(first.paymentDate).getTime());

  const rentalAmount = reservation.totalPrice;
  const extraFees = sumByType(reservationPayments, "PENALTY");
  const totalDue = rentalAmount + extraFees;
  const totalPaid = sumByType(reservationPayments, "RENTAL_PAYMENT");
  const remaining = Math.max(0, totalDue - totalPaid);
  const firstDeposit = reservationPayments.find((payment) => payment.type === "DEPOSIT");
  const refundPayments = reservationPayments.filter((payment) => payment.type === "DEPOSIT_REFUND");
  const latestRefund = refundPayments[0];
  const depositPaid = sumByType(reservationPayments, "DEPOSIT");
  const refundedDeposit = sumByType(reservationPayments, "DEPOSIT_REFUND");
  const depositRefundDecided = reservationPayments.some((payment) => payment.type === "DEPOSIT_REFUND");
  const depositAmount = reservation.depositAmount || firstDeposit?.amount || 0;
  const refundableDeposit = getRefundableDeposit(depositAmount, depositPaid);
  const retainedDeposit = depositRefundDecided ? Math.max(0, refundableDeposit - refundedDeposit) : 0;

  return {
    client: {
      cin: client?.cin || client?.passportNumber || "-",
      name: client ? normalizeClientName(client.fullName) : "Client non renseigné",
    },
    deposit: {
      amount: depositAmount,
      conditions: null,
      method: firstDeposit ? formatPaymentMethod(firstDeposit.method) : null,
      paidAt: firstDeposit?.paymentDate ?? null,
      refundedAmount: refundedDeposit,
      refundedAt: latestRefund?.paymentDate ?? null,
      refundMethod: latestRefund ? formatPaymentMethod(latestRefund.method) : null,
      retainedAmount: retainedDeposit,
      refundConditions: [],
      status: getDepositStatus(depositAmount, depositPaid, refundedDeposit, depositRefundDecided),
      warning: null,
    },
    payment: {
      extraFees,
      remaining,
      rentalAmount,
      totalDue,
      totalPaid,
    },
    reservation: {
      carImageUrl: car?.imageUrl ?? null,
      carName: car ? formatCarName(car.brand, car.model) : "Voiture non renseignée",
      days: getReservationDays(reservation.startDate, reservation.endDate),
      endDate: reservation.endDate,
      paymentMethod: formatPaymentMethod(selectedPayment.method),
      paymentStatus: getPaymentStatus(totalPaid, remaining),
      registration: car ? formatRegistrationNumber(car.registrationNumber) : "-",
      startDate: reservation.startDate,
    },
    transactions: reservationPayments.map((payment) => ({
      amount: payment.amount,
      date: payment.paymentDate,
      description: payment.note || getPaymentDescription(payment),
      id: `PAY-${payment.id}`,
      method: formatPaymentMethod(payment.method),
      type: formatPaymentType(payment.type),
    })),
  };
}

function sumByType(payments: Payment[], type: PaymentType) {
  return payments.filter((payment) => payment.type === type).reduce((sum, payment) => sum + payment.amount, 0);
}

function getPaymentStatus(totalPaid: number, remaining: number): PaymentStatus {
  if (totalPaid <= 0) return "Non payé";
  return remaining > 0 ? "Partiel" : "Payé";
}

function getDepositStatus(depositAmount: number, depositPaid: number, refundedDeposit: number, depositRefundDecided: boolean): DepositStatus {
  if (depositPaid <= 0) return "Non versée";
  const refundableDeposit = getRefundableDeposit(depositAmount, depositPaid);
  if (refundableDeposit > 0 && refundedDeposit >= refundableDeposit) return "Remboursée";
  if (depositRefundDecided && refundedDeposit < refundableDeposit) return "Retenue";
  return "Bloquée";
}

function getRefundableDeposit(depositAmount: number, depositPaid: number) {
  if (depositPaid <= 0) return 0;
  return depositAmount > 0 ? Math.min(depositPaid, depositAmount) : depositPaid;
}

function getReservationDays(startDate: string, endDate: string) {
  const duration = new Date(endDate).getTime() - new Date(startDate).getTime();
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return Math.max(1, Math.ceil(duration / (24 * 60 * 60 * 1000)));
}

function formatPaymentMethod(method: PaymentMethod) {
  const labels: Record<PaymentMethod, string> = {
    BANK_TRANSFER: "Virement",
    CARD: "Carte",
    CASH: "Espèces",
    CHECK: "Chèque",
  };
  return labels[method];
}

function formatPaymentType(type: PaymentType): Transaction["type"] {
  const labels: Record<PaymentType, Transaction["type"]> = {
    DEPOSIT: "Caution",
    DEPOSIT_REFUND: "Remboursement",
    PENALTY: "Pénalité",
    RENTAL_PAYMENT: "Location",
  };
  return labels[type];
}

function getPaymentDescription(payment: Payment) {
  const descriptions: Record<PaymentType, string> = {
    DEPOSIT: "Versement caution de garantie",
    DEPOSIT_REFUND: "Remboursement caution",
    PENALTY: "Frais supplémentaires",
    RENTAL_PAYMENT: "Paiement location",
  };
  return descriptions[payment.type];
}

function Breadcrumb() {
  return (
    <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 text-sm text-muted-foreground">
      <Link className="font-medium text-primary transition-smooth hover:text-primary/80" to="/payments">
        Paiements
      </Link>
      <ChevronRight className="h-4 w-4" />
      <span>Détail du paiement</span>
    </nav>
  );
}

export function PaymentSummaryCard({ data }: { data: PaymentDetailData }) {
  const { client, payment, reservation } = data;

  return (
    <article className="rounded-lg border border-border bg-white p-4 shadow-sm transition-smooth hover:-translate-y-0.5 hover:shadow-md sm:p-5">
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-4 md:flex-row">
          {reservation.carImageUrl ? (
            <img
              alt={reservation.carName}
              className="h-36 w-full rounded-lg object-cover md:h-32 md:w-44"
              src={reservation.carImageUrl}
            />
          ) : (
            <div className="flex h-36 w-full items-center justify-center rounded-lg bg-muted text-muted-foreground md:h-32 md:w-44">
              <CarFront className="h-10 w-10" />
            </div>
          )}

          <div className="grid min-w-0 flex-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold tracking-normal">{client.name}</h2>
                <PaymentStatusBadge status={reservation.paymentStatus} />
              </div>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                {reservation.carName} ({reservation.registration})
              </p>
              <InfoLine icon={IdCard} label="CIN" value={client.cin} />
            </div>

            <div>
              <InfoLine icon={CalendarDays} label="Période" value={formatReservationPeriod(reservation)} />
              <p className="mt-2 text-xs font-medium text-muted-foreground">{reservation.days} jours de location</p>
            </div>

            <div>
              <InfoLine icon={CreditCard} label="Méthode de paiement" value={reservation.paymentMethod} />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-slate-50 p-4">
          <h3 className="text-sm font-semibold">Résumé</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <AmountRow label="Total dû" value={payment.totalDue} />
            <AmountRow label="Total payé" tone="paid" value={payment.totalPaid} />
            <AmountRow label="Reste à payer" tone="danger" value={payment.remaining} />
          </dl>
          <p className="mt-4 rounded-md bg-blue-50 px-3 py-2 text-xs font-medium text-primary">
            La caution est suivie séparément et n'est pas incluse dans ces totaux.
          </p>
        </div>
      </div>
    </article>
  );
}

export function PaymentDetails({ payment, status }: { payment: PaymentDetailData["payment"]; status: PaymentStatus }) {
  const completed = status === "Payé" && payment.remaining === 0;

  return (
    <article className="rounded-lg border border-border bg-white p-5 shadow-sm transition-smooth hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-50 text-primary">
          <CarFront className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-base font-semibold">Détail des paiements (LOCATION)</h2>
          <p className="text-sm text-muted-foreground">Totaux hors caution de garantie</p>
        </div>
      </div>

      <dl className="mt-5 space-y-4">
        <DetailRow icon={WalletCards} label="Montant location" value={formatMoney(payment.rentalAmount)} />
        <DetailRow icon={FileText} label="Frais supplémentaires" value={formatMoney(payment.extraFees)} />
        <DetailRow emphasized label="Total hors caution" value={formatMoney(payment.totalDue)} />
        <DetailRow label="Total payé" tone="paid" value={formatMoney(payment.totalPaid)} />
        <DetailRow label="Reste à payer" tone="danger" value={formatMoney(payment.remaining)} />
      </dl>

      <div
        className={cn(
          "mt-5 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm",
          completed ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800",
        )}
      >
        {completed ? <CheckCircle2 className="mt-0.5 h-5 w-5" /> : <Clock3 className="mt-0.5 h-5 w-5" />}
        <div>
          <p className="font-semibold">{completed ? "Paiement complété" : "Paiement partiel"}</p>
          <p className="mt-0.5 text-xs">
            {completed ? "La location est entièrement réglée." : "Un reste à payer demeure sur la location uniquement."}
          </p>
        </div>
      </div>
    </article>
  );
}

export function DepositDetails({ deposit }: { deposit: PaymentDetailData["deposit"] }) {
  return (
    <article className="rounded-lg border border-amber-200 bg-amber-50/70 p-5 shadow-sm transition-smooth hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4 border-b border-amber-200 pb-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-amber-100 text-amber-700">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-amber-950">Détail de la caution</h2>
              <DepositTooltip />
            </div>
            <p className="text-sm text-amber-800">La caution n'est pas un paiement de location.</p>
          </div>
        </div>
        <DepositStatusBadge status={deposit.status} />
      </div>

      <div className="mt-5 rounded-lg border border-amber-200 bg-white/70 p-4">
        <p className="text-sm font-medium text-amber-800">Montant caution</p>
        <p className="mt-1 text-2xl font-semibold text-amber-950">{formatMoney(deposit.amount)}</p>
      </div>

      <dl className="mt-5 space-y-4">
        <DetailRow icon={ShieldCheck} label="Statut" value={deposit.status} />
        <DetailRow icon={CalendarDays} label="Date de versement" value={deposit.paidAt ? formatDateTime(deposit.paidAt) : "-"} />
        <DetailRow icon={Banknote} label="Méthode" value={deposit.method ?? "-"} />
        <DetailRow icon={RotateCcw} label="Montant remboursé" tone={deposit.refundedAt ? "paid" : undefined} value={formatMoney(deposit.refundedAmount)} />
        <DetailRow icon={CalendarDays} label="Date de remboursement" value={deposit.refundedAt ? formatDateTime(deposit.refundedAt) : "-"} />
        <DetailRow icon={Banknote} label="Méthode remboursement" value={deposit.refundMethod ?? "-"} />
        <DetailRow icon={AlertTriangle} label="Montant retenu" tone={deposit.retainedAmount > 0 ? "danger" : undefined} value={formatMoney(deposit.retainedAmount)} />
        <DetailRow icon={RotateCcw} label="Conditions" value={deposit.conditions ?? "-"} />
      </dl>

      {deposit.refundConditions.length > 0 && (
        <div className="mt-5 rounded-lg border border-amber-200 bg-white/80 p-4">
          <h3 className="text-sm font-semibold text-amber-950">Conditions de remboursement</h3>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {deposit.refundConditions.map((condition) => (
              <li className="flex items-center gap-2 text-sm text-amber-900" key={condition}>
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                {condition}
              </li>
            ))}
          </ul>
        </div>
      )}

      {deposit.warning && (
        <div className="mt-4 flex gap-3 rounded-lg border border-amber-300 bg-amber-100 px-4 py-3 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <h3 className="font-semibold">Important</h3>
            <p className="mt-0.5">{deposit.warning}</p>
          </div>
        </div>
      )}
    </article>
  );
}

export function TransactionsTable({ transactions }: { transactions: Transaction[] }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(() => readStoredPageSize(paymentDetailsPageSizeKey));
  const totalPages = Math.max(1, Math.ceil(transactions.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedTransactions = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * itemsPerPage;
    return transactions.slice(startIndex, startIndex + itemsPerPage);
  }, [itemsPerPage, safeCurrentPage, transactions]);

  function handlePageSizeChange(nextItemsPerPage: number) {
    setItemsPerPage(nextItemsPerPage);
    writeStoredPageSize(paymentDetailsPageSizeKey, nextItemsPerPage);
    setCurrentPage(1);
  }

  return (
    <article className="rounded-lg border border-border bg-white p-5 shadow-sm transition-smooth hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Historique des transactions</h2>
          <p className="text-sm text-muted-foreground">Location et caution restent identifiées par type.</p>
        </div>
      </div>

      <div className="mt-5 w-full overflow-x-auto md:overflow-x-visible">
        <table className="w-full min-w-[680px] table-fixed border-separate border-spacing-0 text-left text-sm md:min-w-0">
          <thead>
            <tr className="bg-slate-50 text-xs uppercase text-muted-foreground">
              <TableHead className="w-[132px] lg:w-[156px]">Date</TableHead>
              <TableHead className="w-[112px] lg:w-[128px]">Type</TableHead>
              <TableHead className="min-w-0">Description</TableHead>
              <TableHead className="w-[104px] lg:w-[122px]">Montant</TableHead>
              <TableHead className="w-[92px] lg:w-[112px]">Méthode</TableHead>
              <TableHead className="w-[58px] text-right lg:w-[66px]">Reçu</TableHead>
            </tr>
          </thead>
          <tbody>
            {paginatedTransactions.map((transaction) => (
              <tr className="border-b border-border last:border-b-0" key={transaction.id}>
                <TableCell className="overflow-hidden whitespace-nowrap">
                  <span className="block truncate">{formatDateTime(transaction.date)}</span>
                </TableCell>
                <TableCell className="overflow-hidden">
                  <span
                    className={cn(
                      "inline-flex max-w-full rounded-full px-2 py-1 text-xs font-semibold ring-1",
                      transaction.type === "Caution" || transaction.type === "Remboursement"
                        ? "bg-amber-50 text-amber-700 ring-amber-200"
                        : "bg-blue-50 text-primary ring-blue-200",
                    )}
                  >
                    <span className="truncate">{transaction.type}</span>
                  </span>
                </TableCell>
                <TableCell className="min-w-0 overflow-hidden">
                  <span className="block truncate">{transaction.description}</span>
                </TableCell>
                <TableCell className="overflow-hidden whitespace-nowrap font-semibold">
                  <span className="block truncate">{formatMoney(transaction.amount)}</span>
                </TableCell>
                <TableCell className="overflow-hidden whitespace-nowrap">
                  <span className="block truncate">{transaction.method}</span>
                </TableCell>
                <TableCell className="text-right">
                  <button
                    aria-label={`Reçu ${transaction.id}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-white text-muted-foreground transition-smooth hover:border-primary hover:text-primary"
                    type="button"
                  >
                    <ReceiptText className="h-4 w-4" />
                  </button>
                </TableCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AppPagination
        currentPage={safeCurrentPage}
        onPageChange={setCurrentPage}
        onPageSizeChange={handlePageSizeChange}
        pageSize={itemsPerPage}
        totalItems={transactions.length}
        totalPages={totalPages}
      />
    </article>
  );
}

function InfoLine({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="mt-3 flex items-start gap-2 text-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="font-semibold">{value}</p>
      </div>
    </div>
  );
}

function DetailRow({
  emphasized,
  icon: Icon,
  label,
  tone,
  value,
}: {
  emphasized?: boolean;
  icon?: LucideIcon;
  label: string;
  tone?: "danger" | "paid";
  value: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 text-sm",
        emphasized && "border-t border-border pt-4 font-semibold",
      )}
    >
      <dt className="flex min-w-0 items-center gap-2 text-muted-foreground">
        {Icon && <Icon className="h-4 w-4 shrink-0" />}
        <span>{label}</span>
      </dt>
      <dd
        className={cn(
          "shrink-0 text-right font-semibold",
          tone === "paid" && "text-emerald-700",
          tone === "danger" && "text-red-600",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function AmountRow({ label, tone, value }: { label: string; tone?: "danger" | "paid"; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "font-semibold",
          tone === "paid" && "text-emerald-700",
          tone === "danger" && "text-red-600",
        )}
      >
        {formatMoney(value)}
      </dd>
    </div>
  );
}

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const className =
    status === "Payé"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : status === "Partiel"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : "bg-red-50 text-red-700 ring-red-200";

  return <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold ring-1", className)}>{status}</span>;
}

function DepositStatusBadge({ status }: { status: DepositStatus }) {
  const className =
    status === "Remboursée"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : status === "Retenue"
        ? "bg-red-50 text-red-700 ring-red-200"
        : status === "Bloquée"
          ? "bg-amber-100 text-amber-800 ring-amber-300"
          : "bg-slate-50 text-slate-700 ring-slate-200";

  return <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1", className)}>{status}</span>;
}

function DepositTooltip() {
  return (
    <span className="group relative inline-flex">
      <button
        aria-label="Explication caution"
        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-amber-700 transition-smooth hover:bg-amber-100"
        type="button"
      >
        <Info className="h-4 w-4" />
      </button>
      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-64 -translate-x-1/2 rounded-md border border-border bg-white px-3 py-2 text-xs font-medium text-foreground opacity-0 shadow-lg transition-smooth group-hover:opacity-100 group-focus-within:opacity-100">
        La caution est une garantie bloquée ou remboursable. Elle ne compte pas dans le total payé ni dans le total dû.
      </span>
    </span>
  );
}

function TableHead({ children, className }: { children: ReactNode; className?: string }) {
  return <th className={cn("border-b border-border px-2 py-3 font-semibold first:rounded-l-md last:rounded-r-md", className)}>{children}</th>;
}

function TableCell({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("border-b border-border px-2 py-4 align-middle last:border-b", className)}>{children}</td>;
}

function formatReservationPeriod(reservation: PaymentDetailData["reservation"]) {
  return `${formatDateTime(reservation.startDate)} -> ${formatDateTime(reservation.endDate)}`;
}
