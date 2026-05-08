import { useEffect, useMemo, useState } from "react";
import { BarChart3, Download, FileSpreadsheet, TrendingDown, TrendingUp } from "lucide-react";
import { PageHeader } from "@/app/layout";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/useToast";
import { getPayments } from "@/services/payment.service";
import { getReservations } from "@/services/reservation.service";
import type { Payment } from "@/types/payment";
import type { Reservation } from "@/types/reservation";
import { getLocalDateKey } from "@/utils/date";
import type { RapportRow } from "@/utils/excel";
import { exportRapportToExcel } from "@/utils/excel";
import { formatMoney } from "@/utils/money";
import { createRapportPdf, downloadPdfBlob } from "@/utils/rapportPdf";

type PeriodPreset = "today" | "week" | "month";

const SETTINGS_KEY = "rentaldesk:settings";

function readAgencyName(): string {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) return "Massar Location";
    const parsed = JSON.parse(stored) as { agencyName?: string };
    return parsed.agencyName?.trim() || "Massar Location";
  } catch {
    return "Massar Location";
  }
}

function todayKey(): string {
  return getLocalDateKey(new Date().toISOString());
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(isoDate);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDisplayDate(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function buildRows(
  payments: Payment[],
  reservations: Reservation[],
  from: string,
  to: string,
): RapportRow[] {
  const rentalPayments = payments.filter((p) => p.type === "RENTAL_PAYMENT");
  const allReservations = reservations.filter((r) => r.status !== "CANCELLED");

  const rows: RapportRow[] = [];
  let current = from;

  while (current <= to) {
    const dayPayments = rentalPayments.filter((p) => getLocalDateKey(p.paymentDate) === current);
    const dayReservations = allReservations.filter(
      (r) => getLocalDateKey(r.startDate) === current || getLocalDateKey(r.endDate) === current,
    );

    const encaisse = dayPayments.reduce((sum, p) => sum + p.amount, 0);
    const ca = dayReservations.reduce((sum, r) => {
      const days = Math.max(
        1,
        Math.ceil(
          (new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / 86_400_000,
        ),
      );
      return sum + r.dailyPrice * days;
    }, 0);

    const reservationIds = new Set(dayReservations.map((r) => r.id));
    const allReservationPayments = rentalPayments.filter((p) => reservationIds.has(p.reservationId));
    const totalPaid = allReservationPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalExpected = dayReservations.reduce((sum, r) => sum + r.totalPrice, 0);
    const reste = Math.max(0, totalExpected - totalPaid);

    rows.push({
      date: current,
      reservations: dayReservations.length,
      ca: Math.round(ca * 100) / 100,
      encaisse: Math.round(encaisse * 100) / 100,
      reste: Math.round(reste * 100) / 100,
    });

    current = addDays(current, 1);
  }

  return rows;
}

export function RapportPage() {
  const { showToast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const today = todayKey();
  const [from, setFrom] = useState(() => addDays(today, -29));
  const [to, setTo] = useState(today);

  useEffect(() => {
    void Promise.all([getPayments(), getReservations()])
      .then(([p, r]) => { setPayments(p); setReservations(r); })
      .finally(() => setLoading(false));
  }, []);

  function applyPreset(preset: PeriodPreset) {
    const t = todayKey();
    if (preset === "today") { setFrom(t); setTo(t); }
    else if (preset === "week") { setFrom(addDays(t, -6)); setTo(t); }
    else { setFrom(addDays(t, -29)); setTo(t); }
  }

  const clampedTo = to < from ? from : to;

  const rows = useMemo(
    () => buildRows(payments, reservations, from, clampedTo),
    [payments, reservations, from, clampedTo],
  );

  const activeRows = rows.filter((r) => r.reservations > 0 || r.encaisse > 0);

  const totals = useMemo(() =>
    rows.reduce(
      (acc, row) => ({
        reservations: acc.reservations + row.reservations,
        ca: acc.ca + row.ca,
        encaisse: acc.encaisse + row.encaisse,
        reste: acc.reste + row.reste,
      }),
      { reservations: 0, ca: 0, encaisse: 0, reste: 0 },
    ), [rows]);

  const periodLabel = `${formatDisplayDate(from)} - ${formatDisplayDate(clampedTo)}`;

  const trend = useMemo(() => {
    if (activeRows.length < 2) return null;
    const mid = Math.floor(activeRows.length / 2);
    const firstHalf = activeRows.slice(0, mid).reduce((s, r) => s + r.encaisse, 0);
    const secondHalf = activeRows.slice(mid).reduce((s, r) => s + r.encaisse, 0);
    if (firstHalf === 0) return null;
    return ((secondHalf - firstHalf) / firstHalf) * 100;
  }, [activeRows]);

  async function handleExportPdf() {
    try {
      setExporting(true);
      const bytes = await createRapportPdf({
        agencyName: readAgencyName(),
        period: periodLabel,
        rows: activeRows.length ? activeRows : rows,
        totals,
        kpis: {
          caTotal: totals.ca,
          encaisse: totals.encaisse,
          reste: totals.reste,
          reservations: totals.reservations,
          trend: trend !== null ? `${trend >= 0 ? "+" : ""}${trend.toFixed(0)}%` : null,
        },
      });
      downloadPdfBlob(bytes, `rapport_ca_${from}_${clampedTo}.pdf`);
      showToast({ title: "PDF exporté", type: "success" });
    } catch (error) {
      showToast({ title: "Erreur PDF", message: String(error), type: "error" });
    } finally {
      setExporting(false);
    }
  }

  function handleExportExcel() {
    try {
      exportRapportToExcel(activeRows.length ? activeRows : rows, periodLabel, `rapport_ca_${from}_${clampedTo}.xlsx`);
      showToast({ title: "Excel exporté", type: "success" });
    } catch (error) {
      showToast({ title: "Erreur Excel", message: String(error), type: "error" });
    }
  }

  return (
    <>
      <PageHeader title="Rapport Chiffre d'Affaires">
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={exporting || loading} onClick={() => void handleExportPdf()} type="button" variant="outline">
            <Download className="h-4 w-4" />
            {exporting ? "Génération..." : "Exporter PDF"}
          </Button>
          <Button disabled={loading} onClick={handleExportExcel} type="button" variant="outline">
            <FileSpreadsheet className="h-4 w-4" />
            Exporter Excel
          </Button>
        </div>
      </PageHeader>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="flex gap-1 rounded-md border border-border bg-muted/50 p-1">
          {(["today", "week", "month"] as PeriodPreset[]).map((preset) => (
            <button
              className="h-8 rounded px-3 text-sm font-medium text-muted-foreground transition hover:bg-background hover:text-foreground"
              key={preset}
              onClick={() => applyPreset(preset)}
              type="button"
            >
              {preset === "today" ? "Aujourd'hui" : preset === "week" ? "7 jours" : "30 jours"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground" htmlFor="from-date">Du</label>
          <input
            className="h-9 rounded-md border border-border bg-white px-3 text-sm dark:bg-slate-900"
            id="from-date"
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            type="date"
            value={from}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground" htmlFor="to-date">Au</label>
          <input
            className="h-9 rounded-md border border-border bg-white px-3 text-sm dark:bg-slate-900"
            id="to-date"
            min={from}
            onChange={(e) => setTo(e.target.value)}
            type="date"
            value={clampedTo}
          />
        </div>
        <span className="text-sm text-muted-foreground">{periodLabel}</span>
      </div>

      {/* KPI cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          borderColor="border-l-emerald-500"
          label="CA Total"
          sub={trend !== null ? `${trend >= 0 ? "+" : ""}${trend.toFixed(0)}% tendance` : undefined}
          subColor={trend !== null ? (trend >= 0 ? "text-emerald-600" : "text-red-500") : undefined}
          icon={trend !== null ? (trend >= 0 ? <TrendingUp className="h-4 w-4 text-emerald-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />) : <BarChart3 className="h-4 w-4 text-emerald-500" />}
          value={formatMoney(totals.ca)}
          valueColor="text-emerald-600 dark:text-emerald-400"
        />
        <KpiCard
          borderColor="border-l-blue-500"
          label="Encaisse"
          sub={totals.ca > 0 ? `${Math.round((totals.encaisse / totals.ca) * 100)}% du CA` : undefined}
          icon={<BarChart3 className="h-4 w-4 text-blue-500" />}
          value={formatMoney(totals.encaisse)}
          valueColor="text-blue-600 dark:text-blue-400"
        />
        <KpiCard
          borderColor="border-l-red-400"
          label="Reste a payer"
          icon={<BarChart3 className="h-4 w-4 text-red-400" />}
          value={formatMoney(totals.reste)}
          valueColor="text-red-500 dark:text-red-400"
        />
        <KpiCard
          borderColor="border-l-slate-400"
          label="Reservations"
          sub={`sur ${rows.length} jours`}
          icon={<BarChart3 className="h-4 w-4 text-slate-500" />}
          value={String(totals.reservations)}
          valueColor="text-foreground"
        />
      </div>

      {/* SVG Curve */}
      <Card className="mb-6 dark:bg-slate-900 dark:border-slate-800">
        <CardTitle className="mb-4 text-base font-semibold text-foreground">Evolution du CA</CardTitle>
        <RevenueLineChart rows={rows} />
      </Card>

      {/* Daily table */}
      <Card className="dark:bg-slate-900 dark:border-slate-800">
        <div className="mb-4 flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-foreground">Detail par jour</CardTitle>
          <span className="text-xs text-muted-foreground">{rows.length} jours</span>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement...</p>
        ) : (
          <DailyTable rows={rows} />
        )}
      </Card>
    </>
  );
}

function KpiCard({
  borderColor,
  icon,
  label,
  sub,
  subColor,
  value,
  valueColor,
}: {
  borderColor: string;
  icon: React.ReactNode;
  label: string;
  sub?: string;
  subColor?: string;
  value: string;
  valueColor: string;
}) {
  return (
    <Card className={`border-l-4 ${borderColor} dark:bg-slate-900 dark:border-l-4 dark:border-slate-800`}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        {icon}
      </div>
      <p className={`mt-2 text-2xl font-semibold ${valueColor}`}>{value}</p>
      {sub && <p className={`mt-1 text-xs ${subColor ?? "text-muted-foreground"}`}>{sub}</p>}
    </Card>
  );
}

function RevenueLineChart({ rows }: { rows: RapportRow[] }) {
  const activeRows = rows.filter((r) => r.encaisse > 0 || r.ca > 0);
  const displayRows = activeRows.length ? activeRows : rows.slice(0, 15);

  if (displayRows.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune donnée sur cette période.</p>;
  }

  const maxCa = Math.max(...displayRows.map((r) => r.ca), 1);
  const maxEnc = Math.max(...displayRows.map((r) => r.encaisse), 1);
  const max = Math.max(maxCa, maxEnc);

  const svgWidth = Math.max(500, displayRows.length * 28);
  const svgHeight = 200;
  const top = 16;
  const bottom = 28;
  const left = 48;
  const right = 12;
  const cw = svgWidth - left - right;
  const ch = svgHeight - top - bottom;

  function ptX(i: number) {
    return left + (displayRows.length <= 1 ? cw / 2 : (i / (displayRows.length - 1)) * cw);
  }
  function ptY(v: number) {
    return top + ch - (max > 0 ? (v / max) * ch : 0);
  }

  const caPath = displayRows.map((r, i) => `${i === 0 ? "M" : "L"} ${ptX(i)} ${ptY(r.ca)}`).join(" ");
  const encPath = displayRows.map((r, i) => `${i === 0 ? "M" : "L"} ${ptX(i)} ${ptY(r.encaisse)}`).join(" ");

  const caAreaClose = ` L ${ptX(displayRows.length - 1)} ${top + ch} L ${ptX(0)} ${top + ch} Z`;
  const encAreaClose = ` L ${ptX(displayRows.length - 1)} ${top + ch} L ${ptX(0)} ${top + ch} Z`;

  return (
    <div className="overflow-x-auto">
      <div className="mb-2 flex items-center gap-4 text-xs text-muted-foreground">
        <span><span className="mr-1 inline-block h-2 w-3 rounded-sm bg-emerald-500" />CA prevu</span>
        <span><span className="mr-1 inline-block h-2 w-3 rounded-sm bg-blue-500" />Encaisse</span>
      </div>
      <svg className="h-52 min-w-full" viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
        {/* Grid */}
        {[0, 1, 2, 3, 4].map((i) => {
          const v = max * (1 - i / 4);
          const gy = top + (i / 4) * ch;
          return (
            <g key={i}>
              <line stroke="#e2e8f0" strokeWidth="1" x1={left} x2={svgWidth - right} y1={gy} y2={gy} />
              <text fill="#94a3b8" fontSize="9" textAnchor="end" x={left - 4} y={gy + 3}>
                {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v)}
              </text>
            </g>
          );
        })}

        {/* CA area */}
        <path d={caPath + caAreaClose} fill="#10b981" fillOpacity="0.08" stroke="none" />
        <path d={caPath} fill="none" stroke="#10b981" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />

        {/* Enc area */}
        <path d={encPath + encAreaClose} fill="#3b82f6" fillOpacity="0.08" stroke="none" />
        <path d={encPath} fill="none" stroke="#3b82f6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" strokeDasharray="4 2" />

        {/* X labels */}
        {displayRows.map((r, i) => {
          const show = displayRows.length <= 14 || i % Math.ceil(displayRows.length / 14) === 0;
          if (!show) return null;
          const label = r.date.slice(5);
          return (
            <text fill="#94a3b8" fontSize="9" key={r.date} textAnchor="middle" x={ptX(i)} y={svgHeight - 6}>
              {label}
            </text>
          );
        })}

        {/* Dots for CA */}
        {displayRows.map((r, i) =>
          r.ca > 0 ? (
            <circle cx={ptX(i)} cy={ptY(r.ca)} fill="#10b981" key={`ca-${r.date}`} r="3">
              <title>{`${r.date} CA: ${formatMoney(r.ca)}`}</title>
            </circle>
          ) : null,
        )}
      </svg>
    </div>
  );
}

function DailyTable({ rows }: { rows: RapportRow[] }) {
  const maxCa = Math.max(...rows.map((r) => r.ca), 1);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-slate-50 dark:bg-slate-950">
            <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Date</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Rés.</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">CA</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Encaissé</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Reste</th>
            <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Barre</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const prev = idx > 0 ? rows[idx - 1].encaisse : null;
            const trend = prev !== null && prev > 0 ? row.encaisse - prev : null;
            return (
              <tr
                className="border-b border-border last:border-0 hover:bg-slate-50 dark:hover:bg-slate-950/50"
                key={row.date}
              >
                <td className="px-3 py-2 font-medium text-foreground">{row.date}</td>
                <td className="px-3 py-2 text-right text-muted-foreground">{row.reservations || "-"}</td>
                <td className="px-3 py-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                  {row.ca > 0 ? formatMoney(row.ca) : "-"}
                </td>
                <td className="px-3 py-2 text-right text-blue-600 dark:text-blue-400">
                  {row.encaisse > 0 ? formatMoney(row.encaisse) : "-"}
                </td>
                <td className="px-3 py-2 text-right text-red-500 dark:text-red-400">
                  {row.reste > 0 ? formatMoney(row.reste) : <span className="text-muted-foreground">-</span>}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${Math.round((row.ca / maxCa) * 100)}%` }}
                      />
                    </div>
                    {trend !== null && (
                      <span className={`text-xs font-medium ${trend >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {trend >= 0 ? "+" : ""}
                        {formatMoney(trend)}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950">
            <td className="px-3 py-2 font-bold text-foreground">TOTAL</td>
            <td className="px-3 py-2 text-right font-bold text-foreground">
              {rows.reduce((s, r) => s + r.reservations, 0)}
            </td>
            <td className="px-3 py-2 text-right font-bold text-emerald-600 dark:text-emerald-400">
              {formatMoney(rows.reduce((s, r) => s + r.ca, 0))}
            </td>
            <td className="px-3 py-2 text-right font-bold text-blue-600 dark:text-blue-400">
              {formatMoney(rows.reduce((s, r) => s + r.encaisse, 0))}
            </td>
            <td className="px-3 py-2 text-right font-bold text-red-500 dark:text-red-400">
              {formatMoney(rows.reduce((s, r) => s + r.reste, 0))}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
