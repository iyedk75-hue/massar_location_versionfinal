import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Banknote, CalendarDays, CarFront, Gauge } from "lucide-react";
import { PageHeader } from "@/app/layout";
import { Card, CardTitle, CardValue } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Car } from "@/types/car";
import type { Payment } from "@/types/payment";
import type { Reservation } from "@/types/reservation";
import { getCars } from "@/services/car.service";
import { getPayments } from "@/services/payment.service";
import { getReservations } from "@/services/reservation.service";
import { cn } from "@/lib/utils";
import { formatCarName } from "@/utils/car";
import { formatDate, getLocalDateKey } from "@/utils/date";
import { formatMoney } from "@/utils/money";

type AlertItem = {
  car: Car;
  label: string;
  date?: string | null;
  tone: "warning" | "danger";
};

type RevenuePeriod = "day" | "month" | "sixMonths" | "year";

type RevenuePoint = {
  key: string;
  label: string;
  value: number;
};

type RevenueSlice = {
  color: string;
  label: string;
  value: number;
};

const revenuePeriods: Array<{ label: string; value: RevenuePeriod }> = [
  { label: "Jour", value: "day" },
  { label: "Mois", value: "month" },
  { label: "6 mois", value: "sixMonths" },
  { label: "Année", value: "year" },
];

const paymentMethodLabels: Record<Payment["method"], string> = {
  CASH: "Espèces",
  CARD: "Carte",
  BANK_TRANSFER: "Virement",
  CHECK: "Chèque",
};

const paymentMethodColors: Record<Payment["method"], string> = {
  CASH: "#1d4ed8",
  CARD: "#0f766e",
  BANK_TRANSFER: "#e11d48",
  CHECK: "#d97706",
};

export function DashboardPage() {
  const [cars, setCars] = useState<Car[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [revenuePeriod, setRevenuePeriod] = useState<RevenuePeriod>("month");
  const [revenueModalOpen, setRevenueModalOpen] = useState(false);

  useEffect(() => {
    void Promise.all([getCars(), getReservations(), getPayments()]).then(([carsData, reservationsData, paymentsData]) => {
      setCars(carsData);
      setReservations(reservationsData);
      setPayments(paymentsData);
    });
  }, []);

  const todayKey = getDateKey(new Date());
  const currentMonthKey = todayKey.slice(0, 7);
  const previousMonthKey = getPreviousMonthKey(currentMonthKey);

  const stats = useMemo(() => {
    const availableCars = cars.filter((car) => car.status === "AVAILABLE").length;
    const rentedCars = cars.filter((car) => car.status === "RENTED").length;
    const maintenanceCars = cars.filter((car) => car.status === "MAINTENANCE").length;
    const ongoingReservations = reservations.filter((reservation) => reservation.status === "ONGOING").length;
    const activeTodayCarIds = new Set(
      reservations
        .filter(
          (reservation) =>
            reservation.status !== "CANCELLED" &&
            reservation.status !== "COMPLETED" &&
            getLocalDateKey(reservation.startDate) <= todayKey &&
            getLocalDateKey(reservation.endDate) >= todayKey,
        )
        .map((reservation) => reservation.carId),
    );
    const availableTodayCars = cars.filter(
      (car) => car.status !== "MAINTENANCE" && car.status !== "UNAVAILABLE" && !activeTodayCarIds.has(car.id),
    ).length;
    const lateReturns = reservations.filter(
      (reservation) => reservation.status === "ONGOING" && getLocalDateKey(reservation.endDate) < todayKey,
    ).length;
    const reservationsToConfirm = reservations.filter(
      (reservation) => reservation.status === "EN_ATTENTE" && getLocalDateKey(reservation.startDate) >= todayKey,
    ).length;
    const upcomingReservations = reservations.filter(
      (reservation) =>
        (reservation.status === "EN_ATTENTE" || reservation.status === "RESERVED") &&
        getLocalDateKey(reservation.startDate) > todayKey,
    ).length;
    const currentMonthRevenue = sumRentalPaymentsByMonth(payments, currentMonthKey);
    const previousMonthRevenue = sumRentalPaymentsByMonth(payments, previousMonthKey);
    const revenueTrend =
      previousMonthRevenue > 0 ? ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100 : null;
    const alerts = getAlerts(cars, todayKey);

    return {
      alerts,
      availableCars,
      availableTodayCars,
      currentMonthRevenue,
      lateReturns,
      maintenanceCars,
      ongoingReservations,
      rentedCars,
      reservationsToConfirm,
      revenueTrend,
      totalCars: cars.length,
      upcomingReservations,
    };
  }, [cars, currentMonthKey, payments, previousMonthKey, reservations, todayKey]);

  const revenueReport = useMemo(
    () => buildRevenueReport(payments, revenuePeriod, new Date()),
    [payments, revenuePeriod],
  );
  const insuranceAlerts = stats.alerts.filter((alert) => alert.label.includes("Assurance")).length;
  const technicalVisitAlerts = stats.alerts.filter((alert) => alert.label.includes("Visite")).length;

  return (
    <>
      <PageHeader title="Tableau de bord" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard href="/cars" icon={CarFront} label="Total des voitures" tone="info" value={stats.totalCars} />
        <StatCard href="/cars?status=available" icon={Gauge} label="Voitures disponibles" tone="success" value={stats.availableCars} />
        <StatCard href="/reservations?status=ongoing" icon={CalendarDays} label="Locations en cours" tone="info" value={stats.ongoingReservations} />
        <StatCard href="/reservations?status=reserved" icon={CalendarDays} label="Réservations à venir" tone="warning" value={stats.upcomingReservations} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <button className="text-left" onClick={() => setRevenueModalOpen(true)} type="button">
          <Card className="h-full transition hover:border-blue-300 hover:bg-blue-50/40 hover:shadow-md">
            <div className="flex items-center justify-between">
              <CardTitle>Revenus du mois</CardTitle>
              <Banknote className="h-5 w-5 text-muted-foreground" />
            </div>
            <CardValue>{formatMoney(stats.currentMonthRevenue)}</CardValue>
            <p className="mt-1 text-sm text-muted-foreground">Payé : {formatMoney(stats.currentMonthRevenue)}</p>
            <p className={cn("mt-2 text-sm font-medium", getTrendClassName(stats.revenueTrend))}>
              {formatTrend(stats.revenueTrend)} vs mois dernier
            </p>
            <p className="mt-3 text-sm font-medium text-blue-700">Cliquez pour afficher plus de détails</p>
          </Card>
        </button>

        <Card>
          <CardTitle>Priorité aujourd'hui</CardTitle>
          <div className="mt-4 space-y-2 text-sm">
            <TodayRow label="Voitures disponibles aujourd'hui" value={stats.availableTodayCars} />
            <TodayRow label="Retards de retour" value={stats.lateReturns} />
            <TodayRow label="Réservations à confirmer" value={stats.reservationsToConfirm} />
          </div>
        </Card>
      </div>

      <RevenueAnalysisDialog
        onOpenChange={setRevenueModalOpen}
        open={revenueModalOpen}
        period={revenuePeriod}
        report={revenueReport}
        revenueTrend={stats.revenueTrend}
        setPeriod={setRevenuePeriod}
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardTitle>État flotte</CardTitle>
          <div className="mt-4 space-y-2 text-sm">
            <TodayRow label="Disponibles" value={stats.availableCars} />
            <TodayRow label="Louées" value={stats.rentedCars} />
            <TodayRow label="Maintenance" value={stats.maintenanceCars} />
          </div>
        </Card>

        <Link to="/cars?alert=documents">
          <Card className="h-full border-red-200 bg-red-50/60 transition hover:bg-red-50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-red-700">Alertes</CardTitle>
              <AlertTriangle className="h-5 w-5 text-red-700" />
            </div>
            <CardValue>{stats.alerts.length}</CardValue>
            <div className="mt-3 space-y-1 text-sm text-red-800">
              <p>{insuranceAlerts} assurances à expirer</p>
              <p>{technicalVisitAlerts} visites techniques</p>
            </div>
          </Card>
        </Link>

        <Card>
          <CardTitle>Priorités</CardTitle>
          <div className="mt-4 space-y-3">
            {stats.alerts.slice(0, 3).length ? (
              stats.alerts.slice(0, 3).map((alert) => <AlertRow alert={alert} key={`${alert.car.id}-${alert.label}`} />)
            ) : (
              <p className="text-sm text-muted-foreground">Aucune alerte critique.</p>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}

function StatCard({
  href,
  icon: Icon,
  label,
  tone,
  value,
}: {
  href: string;
  icon: typeof CarFront;
  label: string;
  tone: "success" | "warning" | "info";
  value: number;
}) {
  const toneClassName = {
    info: "border-blue-200 bg-blue-50/60 text-blue-900 hover:bg-blue-50",
    success: "border-emerald-200 bg-emerald-50/60 text-emerald-900 hover:bg-emerald-50",
    warning: "border-amber-200 bg-amber-50/60 text-amber-900 hover:bg-amber-50",
  }[tone];

  return (
    <Link to={href}>
      <Card className={cn("h-full transition", toneClassName)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-current">{label}</CardTitle>
          <Icon className="h-5 w-5 opacity-75" />
        </div>
        <CardValue>{value}</CardValue>
      </Card>
    </Link>
  );
}

function TodayRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function AlertRow({ alert }: { alert: AlertItem }) {
  const className = alert.tone === "danger" ? "text-red-700" : "text-amber-700";

  return (
    <div className="rounded-md border border-border p-3 text-sm">
      <div className={cn("flex items-center gap-2 font-medium", className)}>
        <AlertTriangle className="h-4 w-4" />
        {formatCarName(alert.car.brand, alert.car.model)}
      </div>
      <p className="mt-1 text-muted-foreground">
        {alert.label}
        {alert.date ? ` le ${formatDate(alert.date)}` : ""}
      </p>
    </div>
  );
}

function RevenueAnalysisDialog({
  onOpenChange,
  open,
  period,
  report,
  revenueTrend,
  setPeriod,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  period: RevenuePeriod;
  report: ReturnType<typeof buildRevenueReport>;
  revenueTrend: number | null;
  setPeriod: (period: RevenuePeriod) => void;
}) {
  const averageRevenue = report.unitCount > 0 ? report.total / report.unitCount : 0;
  const averageBasket = averageRevenue;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[92vh] w-[min(96vw,1120px)] overflow-y-auto p-6 data-[state=open]:animate-[modal-in_180ms_ease-out]">
        <DialogHeader className="mb-7 pr-10">
          <DialogTitle>Revenus</DialogTitle>
          <p className="text-sm text-muted-foreground">Analyse détaillée des revenus</p>
        </DialogHeader>

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="inline-flex w-fit rounded-md border border-border bg-muted/50 p-1">
            {revenuePeriods.map((item) => (
              <button
                className={cn(
                  "h-9 rounded px-4 text-sm font-medium text-muted-foreground transition",
                  period === item.value && "bg-primary text-primary-foreground shadow-sm",
                )}
                key={item.value}
                onClick={() => setPeriod(item.value)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex h-10 items-center gap-2 rounded-md border border-border bg-white px-3 text-sm text-muted-foreground">
            <CalendarDays className="h-4 w-4 text-primary" />
            {report.rangeLabel}
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <RevenueKpiCard
            icon={Banknote}
            label="Revenu total"
            meta={`Payé : ${formatMoney(report.total)}`}
            trend={formatTrend(revenueTrend)}
            trendClassName={getTrendClassName(revenueTrend)}
            value={formatMoney(report.total)}
          />
          <RevenueKpiCard icon={Gauge} label="Revenu moyen" meta="Par location" value={formatKpiMoney(averageRevenue)} />
          <RevenueKpiCard icon={CarFront} label="Nombre de locations" meta="Total locations" value={String(report.unitCount)} />
          <RevenueKpiCard icon={Banknote} label="Panier moyen" meta="Par location" value={formatKpiMoney(averageBasket)} />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.45fr_1fr]">
          <Card>
            <CardTitle className="text-foreground">Évolution des revenus</CardTitle>
            <RevenueLineChart points={report.points} />
          </Card>

          <Card>
            <CardTitle className="text-foreground">Répartition par moyen de paiement</CardTitle>
            <RevenueDonutChart slices={report.methodSlices} total={report.total} />
          </Card>
        </div>

        <Card className="mt-4">
          <CardTitle className="text-foreground">Revenus par jour</CardTitle>
          <RevenueBarChart points={report.points} />
        </Card>

        <div className="mt-5 flex justify-end">
          <DialogClose asChild>
            <Button variant="outline">Fermer</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RevenueKpiCard({
  icon: Icon,
  label,
  meta,
  trend,
  trendClassName,
  value,
}: {
  icon: typeof Banknote;
  label: string;
  meta: string;
  trend?: string;
  trendClassName?: string;
  value: string;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <CardTitle>{label}</CardTitle>
        <Icon className="h-5 w-5 text-blue-600" />
      </div>
      <CardValue>{value}</CardValue>
      <p className="mt-1 text-sm text-muted-foreground">{meta}</p>
      {trend && <p className={cn("mt-2 text-sm font-medium", trendClassName)}>{trend} vs mois dernier</p>}
    </Card>
  );
}

function RevenueLineChart({ points }: { points: RevenuePoint[] }) {
  const max = Math.max(...points.map((point) => point.value), 0);
  const width = Math.max(520, points.length * 22);
  const height = 220;
  const top = 20;
  const right = 16;
  const bottom = 32;
  const left = 44;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const coordinates = points.map((point, index) => {
    const x = left + (points.length <= 1 ? 0 : (index / (points.length - 1)) * chartWidth);
    const y = top + chartHeight - (max > 0 ? (point.value / max) * chartHeight : 0);
    return { ...point, x, y };
  });
  const path = coordinates.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  return (
    <div className="mt-4 overflow-x-auto">
      <svg aria-label="Courbe d'évolution des revenus" className="h-64 min-w-full" role="img" viewBox={`0 0 ${width} ${height}`}>
        {[0, 1, 2, 3, 4].map((line) => {
          const value = max * (1 - line / 4);
          const y = top + (line / 4) * chartHeight;
          return (
            <g key={line}>
              <line stroke="#e2e8f0" strokeWidth="1" x1={left} x2={width - right} y1={y} y2={y} />
              <text fill="#475569" fontSize="11" textAnchor="end" x={left - 8} y={y + 4}>
                {formatAxisMoney(value)}
              </text>
            </g>
          );
        })}

        <path d={path} fill="none" stroke="#1d4ed8" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
        {coordinates.map((point) => (
          <g key={point.key}>
            <circle cx={point.x} cy={point.y} fill="#1d4ed8" r={point.value > 0 ? 4 : 2.5}>
              <title>{`${point.label} : ${formatMoney(point.value)}`}</title>
            </circle>
            <text fill="#475569" fontSize="10" textAnchor="middle" x={point.x} y={height - 10}>
              {point.label}
            </text>
          </g>
        ))}
      </svg>
      {max === 0 && <p className="mt-2 text-sm text-muted-foreground">Aucun revenu location sur cette période.</p>}
    </div>
  );
}

function RevenueBarChart({ points }: { points: RevenuePoint[] }) {
  const max = Math.max(...points.map((point) => point.value), 0);
  const chartHeight = 168;
  const barWidth = 24;
  const gap = 12;
  const chartWidth = Math.max(280, points.length * (barWidth + gap) + gap);

  return (
    <div className="mt-6">
      <div className="overflow-x-auto">
        <svg
          aria-label="Graphique des revenus"
          className="h-56 min-w-full"
          role="img"
          viewBox={`0 0 ${chartWidth} 220`}
        >
          {[0, 1, 2, 3].map((line) => {
            const y = 20 + line * 48;
            return <line key={line} stroke="#e2e8f0" strokeWidth="1" x1="0" x2={chartWidth} y1={y} y2={y} />;
          })}
          {points.map((point, index) => {
            const height = max > 0 ? Math.max(4, (point.value / max) * chartHeight) : 4;
            const x = gap + index * (barWidth + gap);
            const y = 188 - height;

            return (
              <g key={point.key}>
                <rect fill="#1d4ed8" height={height} rx="4" width={barWidth} x={x} y={y}>
                  <title>{`${point.label} : ${formatMoney(point.value)}`}</title>
                </rect>
                <text fill="#475569" fontSize="10" textAnchor="middle" x={x + barWidth / 2} y="208">
                  {point.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {max === 0 && <p className="mt-2 text-sm text-muted-foreground">Aucun revenu location sur cette période.</p>}
    </div>
  );
}

function RevenueDonutChart({ slices, total }: { slices: RevenueSlice[]; total: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center xl:flex-col xl:items-start">
      <div className="relative h-36 w-36 shrink-0">
        <svg aria-label="Répartition des revenus" className="h-36 w-36 -rotate-90" role="img" viewBox="0 0 120 120">
          <circle cx="60" cy="60" fill="none" r={radius} stroke="#e2e8f0" strokeWidth="18" />
          {slices.map((slice) => {
            const length = total > 0 ? (slice.value / total) * circumference : 0;
            const circle = (
              <circle
                cx="60"
                cy="60"
                fill="none"
                key={slice.label}
                r={radius}
                stroke={slice.color}
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
                strokeWidth="18"
              >
                <title>{`${slice.label} : ${formatMoney(slice.value)}`}</title>
              </circle>
            );
            offset += length;
            return circle;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="text-sm font-semibold">{formatMoney(total)}</span>
        </div>
      </div>

      <div className="w-full space-y-2 text-sm">
        {slices.length ? (
          slices.map((slice) => (
            <div className="flex items-center justify-between gap-3" key={slice.label}>
              <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
                <span className="truncate">{slice.label}</span>
              </span>
              <span className="font-medium">{formatMoney(slice.value)}</span>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Aucune méthode de paiement à afficher.</p>
        )}
      </div>
    </div>
  );
}

function sumRentalPaymentsByMonth(payments: Payment[], monthKey: string) {
  return payments
    .filter((payment) => payment.type === "RENTAL_PAYMENT" && payment.paymentDate.slice(0, 7) === monthKey)
    .reduce((sum, payment) => sum + payment.amount, 0);
}

function buildRevenueReport(payments: Payment[], period: RevenuePeriod, now: Date) {
  const rentalPayments = payments.filter((payment) => payment.type === "RENTAL_PAYMENT");
  const points = buildRevenuePoints(period, now);
  const pointMap = new Map(points.map((point) => [point.key, point]));
  const { end, start } = getRevenueRange(period, now);
  const methodTotals = new Map<Payment["method"], number>();
  const paidReservationIds = new Set<number>();

  for (const payment of rentalPayments) {
    const paymentDate = new Date(payment.paymentDate);
    if (!Number.isFinite(paymentDate.getTime()) || paymentDate < start || paymentDate > end) continue;

    const key = getRevenuePointKey(period, paymentDate);
    const point = pointMap.get(key);
    if (point) {
      point.value += payment.amount;
    }

    methodTotals.set(payment.method, (methodTotals.get(payment.method) ?? 0) + payment.amount);
    paidReservationIds.add(payment.reservationId);
  }

  const methodSlices = Array.from(methodTotals.entries())
    .filter(([, value]) => value > 0)
    .map(([method, value]) => ({
      color: paymentMethodColors[method],
      label: paymentMethodLabels[method],
      value,
    }));

  return {
    methodSlices,
    points,
    rangeLabel: formatRevenueRange(start, end),
    subtitle: getRevenueSubtitle(period, start, end),
    title: getRevenueTitle(period),
    total: points.reduce((sum, point) => sum + point.value, 0),
    unitCount: paidReservationIds.size,
  };
}

function buildRevenuePoints(period: RevenuePeriod, now: Date): RevenuePoint[] {
  if (period === "day") {
    return [0, 4, 8, 12, 16, 20].map((hour) => ({
      key: String(hour).padStart(2, "0"),
      label: `${hour}h`,
      value: 0,
    }));
  }

  if (period === "month") {
    const year = now.getFullYear();
    const month = now.getMonth();
    const days = new Date(year, month + 1, 0).getDate();

    return Array.from({ length: days }, (_, index) => {
      const day = index + 1;
      return {
        key: formatDateKey(year, month, day),
        label: String(day).padStart(2, "0"),
        value: 0,
      };
    });
  }

  const monthCount = period === "sixMonths" ? 6 : 12;
  const firstMonth = period === "sixMonths" ? now.getMonth() - 5 : 0;

  return Array.from({ length: monthCount }, (_, index) => {
    const date = new Date(now.getFullYear(), firstMonth + index, 1);
    return {
      key: formatMonthKey(date.getFullYear(), date.getMonth()),
      label: new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(date).replace(".", ""),
      value: 0,
    };
  });
}

function getRevenuePointKey(period: RevenuePeriod, date: Date) {
  if (period === "day") {
    return String(Math.floor(date.getHours() / 4) * 4).padStart(2, "0");
  }

  if (period === "month") {
    return formatDateKey(date.getFullYear(), date.getMonth(), date.getDate());
  }

  return formatMonthKey(date.getFullYear(), date.getMonth());
}

function getRevenueRange(period: RevenuePeriod, now: Date) {
  if (period === "day") {
    return {
      end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
      start: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    };
  }

  if (period === "month") {
    return {
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
      start: new Date(now.getFullYear(), now.getMonth(), 1),
    };
  }

  if (period === "sixMonths") {
    return {
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
      start: new Date(now.getFullYear(), now.getMonth() - 5, 1),
    };
  }

  return {
    end: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999),
    start: new Date(now.getFullYear(), 0, 1),
  };
}

function getRevenueTitle(period: RevenuePeriod) {
  const labels: Record<RevenuePeriod, string> = {
    day: "Revenus du jour",
    month: "Revenus du mois",
    sixMonths: "Revenus sur 6 mois",
    year: "Revenus de l'année",
  };

  return labels[period];
}

function getRevenueSubtitle(period: RevenuePeriod, start: Date, end: Date) {
  if (period === "day") return `Encaissements location du ${formatDisplayDate(start)}`;
  return `Encaissements location du ${formatDisplayDate(start)} au ${formatDisplayDate(end)}`;
}

function formatDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatMonthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function formatDisplayDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatRevenueRange(start: Date, end: Date) {
  return `${formatDisplayDate(start)} - ${formatDisplayDate(end)}`;
}

function formatKpiMoney(value: number) {
  const amount = new Intl.NumberFormat("fr-TN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value);

  return `${amount} DT`;
}

function formatAxisMoney(value: number) {
  return `${Math.round(value)} DT`;
}

function getAlerts(cars: Car[], todayKey: string): AlertItem[] {
  return cars.flatMap((car) => {
    const alerts: AlertItem[] = [];

    if (isDueSoon(car.insuranceExpiryDate, todayKey)) {
      alerts.push({ car, date: car.insuranceExpiryDate, label: "Assurance expire", tone: "warning" });
    }

    if (isExpired(car.technicalVisitExpiryDate, todayKey)) {
      alerts.push({ car, date: car.technicalVisitExpiryDate, label: "Visite technique expirée", tone: "danger" });
    } else if (isDueSoon(car.technicalVisitExpiryDate, todayKey)) {
      alerts.push({ car, date: car.technicalVisitExpiryDate, label: "Visite technique expire", tone: "warning" });
    }

    return alerts;
  });
}

function isDueSoon(value: string | null | undefined, todayKey: string) {
  if (!value) return false;

  const days = daysBetween(todayKey, value.slice(0, 10));
  return days >= 0 && days <= 30;
}

function isExpired(value: string | null | undefined, todayKey: string) {
  if (!value) return false;
  return value.slice(0, 10) < todayKey;
}

function daysBetween(startKey: string, endKey: string) {
  const start = new Date(`${startKey}T00:00:00`);
  const end = new Date(`${endKey}T00:00:00`);
  return Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

function getDateKey(date: Date) {
  return getLocalDateKey(date);
}

function getPreviousMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
}

function formatTrend(value: number | null) {
  if (value === null) return "Nouvelle base";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${Math.round(value)}%`;
}

function getTrendClassName(value: number | null) {
  if (value === null) return "text-muted-foreground";
  return value >= 0 ? "text-emerald-700" : "text-red-700";
}
