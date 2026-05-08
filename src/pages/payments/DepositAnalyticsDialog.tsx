import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Clock3,
  Download,
  Eye,
  History,
  Printer,
  RotateCcw,
  Search,
  ShieldCheck,
  ShieldOff,
  TriangleAlert,
  Users,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Car } from "@/types/car";
import type { Client } from "@/types/client";
import type { Payment } from "@/types/payment";
import type { Reservation } from "@/types/reservation";
import { cn } from "@/lib/utils";
import { formatCarName } from "@/utils/car";
import { normalizeClientName } from "@/utils/client";
import { formatMoney } from "@/utils/money";

type DepositAnalyticsDialogProps = {
  cars: Car[];
  clients: Client[];
  onOpenChange: (open: boolean) => void;
  onRefund: (reservationId: number) => void;
  open: boolean;
  payments: Payment[];
  reservations: Reservation[];
};

type DepositStatus = "Bloquée" | "Remboursée" | "Partielle";

type DepositRow = {
  car?: Car;
  client?: Client;
  depositPaid: number;
  depositPayment?: Payment;
  id: number;
  isLate: boolean;
  refundedAt?: string;
  refundedAmount: number;
  remaining: number;
  reservation: Reservation;
  reservationCode: string;
  status: DepositStatus;
};

type ChartPoint = {
  label: string;
  paid: number;
  refunded: number;
  sortKey: number;
};

export type DepositAnalyticsMockRow = {
  client: string;
  paidAt: string;
  refunded: number;
  remaining: number;
  reservation: string;
  status: DepositStatus;
  total: number;
};

export const mockDepositAnalyticsRows: DepositAnalyticsMockRow[] = [
  { client: "Houssem Bouraoui", paidAt: "01 avr. 2026", refunded: 0, remaining: 1000, reservation: "RES-2026-0042", status: "Bloquée", total: 1000 },
  { client: "Nada Mhamdi", paidAt: "03 avr. 2026", refunded: 300, remaining: 0, reservation: "RES-2026-0038", status: "Remboursée", total: 300 },
  { client: "Rim Hentati", paidAt: "30 mars 2026", refunded: 500, remaining: 0, reservation: "RES-2026-0035", status: "Remboursée", total: 500 },
  { client: "Aziz Ben Amor", paidAt: "28 mars 2026", refunded: 0, remaining: 300, reservation: "RES-2026-0031", status: "Bloquée", total: 300 },
  { client: "Skander Achour", paidAt: "24 mars 2026", refunded: 0, remaining: 800, reservation: "RES-2026-0029", status: "Bloquée", total: 800 },
];

const pageSize = 5;
const donutColors = ["#f59e0b", "#34c38f"];

export function DepositAnalyticsDialog({
  cars,
  clients,
  onOpenChange,
  onRefund,
  open,
  payments,
  reservations,
}: DepositAnalyticsDialogProps) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const clientsById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const carsById = useMemo(() => new Map(cars.map((car) => [car.id, car])), [cars]);
  const rows = useMemo(() => buildDepositRows(reservations, payments, clientsById, carsById), [carsById, clientsById, payments, reservations]);
  const stats = useMemo(() => buildDepositStats(rows), [rows]);
  const chartData = useMemo(() => buildChartData(rows), [rows]);
  const filteredRows = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return rows;

    return rows.filter((row) => {
      const haystack = `${normalizeClientName(row.client?.fullName ?? "")} ${row.client?.cin ?? ""} ${row.reservationCode} ${
        row.car ? formatCarName(row.car.brand, row.car.model) : ""
      }`.toLowerCase();
      return haystack.includes(value);
    });
  }, [query, rows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const refundedRatio = stats.totalPaid > 0 ? (stats.totalRefunded / stats.totalPaid) * 100 : 0;

  function updateQuery(value: string) {
    setQuery(value);
    setPage(1);
  }

  function handleExport() {
    exportDepositRows(filteredRows);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="h-[92vh] w-[95vw] max-w-none overflow-hidden rounded-3xl border-slate-200 bg-white p-0 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        <div className="flex h-full flex-col">
          <DialogHeader className="mb-0 flex flex-row items-start justify-between gap-6 border-b border-slate-200 px-8 py-6 pr-20 dark:border-slate-800">
            <div className="flex min-w-0 items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                <ShieldCheck className="h-7 w-7" />
              </span>
              <div className="min-w-0">
                <DialogTitle className="text-2xl font-semibold tracking-normal text-slate-950 dark:text-slate-100">
                  Détails des cautions
                </DialogTitle>
                <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                  Analyse complète des cautions de location
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button className="rounded-xl border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900" onClick={handleExport} type="button" variant="outline">
                <Download className="h-4 w-4" />
                Exporter
              </Button>
              <Button className="rounded-xl border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900" onClick={handlePrint} type="button" variant="outline">
                <Printer className="h-4 w-4" />
                Imprimer
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-8 py-6">
            {rows.length === 0 ? (
              <DepositEmptyState onBack={() => onOpenChange(false)} />
            ) : (
              <div className="space-y-5 animate-fade-in">
                <section className="grid gap-4 xl:grid-cols-5">
                  <KpiCard
                    detail="100% du total"
                    icon={ShieldCheck}
                    label="Caution versée totale"
                    tone="violet"
                    value={formatMoney(stats.totalPaid)}
                  />
                  <KpiCard
                    detail={`${formatPercent(refundedRatio)} du total`}
                    icon={RotateCcw}
                    label="Caution remboursée"
                    tone="green"
                    value={formatMoney(stats.totalRefunded)}
                  />
                  <KpiCard
                    detail={`${formatPercent(100 - refundedRatio)} du total`}
                    icon={Clock3}
                    label="Caution restante"
                    tone="orange"
                    value={formatMoney(stats.totalRemaining)}
                  />
                  <KpiCard detail="Sur la période" icon={Users} label="Nombre de cautions" tone="blue" value={String(stats.count)} />
                  <KpiCard detail="À rembourser" icon={TriangleAlert} label="Cautions en retard" tone="red" value={String(stats.lateCount)} />
                </section>

                <section className="grid gap-5 xl:grid-cols-[1.2fr_0.95fr]">
                  <ChartPanel title="Évolution des cautions (DT)">
                    <div className="mb-4 flex flex-wrap items-center gap-5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      <LegendDot className="bg-violet-500" label="Caution versée" />
                      <LegendDot className="bg-emerald-500" label="Caution remboursée" />
                    </div>
                    <div className="h-64">
                      <ResponsiveContainer height="100%" width="100%">
                        <LineChart data={chartData} margin={{ bottom: 0, left: 0, right: 18, top: 12 }}>
                          <defs>
                            <linearGradient id="depositLine" x1="0" x2="1" y1="0" y2="0">
                              <stop offset="0%" stopColor="#8b5cf6" />
                              <stop offset="100%" stopColor="#6d5dfc" />
                            </linearGradient>
                            <linearGradient id="refundLine" x1="0" x2="1" y1="0" y2="0">
                              <stop offset="0%" stopColor="#34c38f" />
                              <stop offset="100%" stopColor="#10b981" />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 6" vertical={false} />
                          <XAxis axisLine={false} dataKey="label" tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }} tickLine={false} />
                          <YAxis axisLine={false} tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }} tickFormatter={formatCompactMoney} tickLine={false} width={52} />
                          <Tooltip content={<ModernTooltip />} />
                          <Line activeDot={{ r: 5 }} dataKey="paid" dot={{ r: 3 }} name="Caution versée" stroke="url(#depositLine)" strokeWidth={3} type="monotone" />
                          <Line activeDot={{ r: 5 }} dataKey="refunded" dot={{ r: 3 }} name="Caution remboursée" stroke="url(#refundLine)" strokeWidth={3} type="monotone" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </ChartPanel>

                  <ChartPanel title="Répartition des cautions">
                    <div className="grid min-h-72 items-center gap-4 md:grid-cols-[1fr_0.9fr]">
                      <div className="relative h-64">
                        <ResponsiveContainer height="100%" width="100%">
                          <PieChart>
                            <Pie
                              animationDuration={800}
                              cornerRadius={10}
                              data={[
                                { name: "Caution restante", value: stats.totalRemaining },
                                { name: "Caution remboursée", value: stats.totalRefunded },
                              ]}
                              dataKey="value"
                              innerRadius="64%"
                              outerRadius="88%"
                              paddingAngle={2}
                            >
                              {donutColors.map((color) => (
                                <Cell fill={color} key={color} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                          <p className="text-xl font-bold text-slate-950 dark:text-slate-100">{formatMoney(stats.totalPaid)}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Total cautions</p>
                        </div>
                      </div>
                      <div className="space-y-5 text-sm">
                        <DonutLegend color="bg-amber-500" label="Caution restante" percent={100 - refundedRatio} value={stats.totalRemaining} />
                        <DonutLegend color="bg-emerald-500" label="Caution remboursée" percent={refundedRatio} value={stats.totalRefunded} />
                        <div className="pt-4">
                          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                            <span>Ratio remboursé / total</span>
                            <span className="text-slate-800 dark:text-slate-100">{formatPercent(refundedRatio)}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${Math.min(100, refundedRatio)}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </ChartPanel>
                </section>

                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-slate-950 dark:text-slate-100">
                        Liste des cautions ({filteredRows.length} résultat{filteredRows.length > 1 ? "s" : ""})
                      </h3>
                      <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">Recherche simple, sans filtres complexes.</p>
                    </div>
                    <div className="relative w-full md:w-80">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        className="h-10 rounded-xl border-slate-200 bg-white pl-10 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                        onChange={(event) => updateQuery(event.target.value)}
                        placeholder="Rechercher client, réservation..."
                        value={query}
                      />
                    </div>
                  </div>
                  <DepositDataGrid onRefund={onRefund} rows={paginatedRows} />
                  <DepositPagination currentPage={safePage} onPageChange={setPage} totalPages={totalPages} />
                </section>
              </div>
            )}
          </div>

          <div className="flex justify-end border-t border-slate-200 px-8 py-4 dark:border-slate-800">
            <Button className="rounded-xl px-8" onClick={() => onOpenChange(false)} type="button" variant="outline">
              Fermer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function KpiCard({
  detail,
  icon: Icon,
  label,
  tone,
  value,
}: {
  detail: string;
  icon: typeof ShieldCheck;
  label: string;
  tone: "blue" | "green" | "orange" | "red" | "violet";
  value: string;
}) {
  const styles = {
    blue: "border-blue-200 bg-blue-50/30 text-blue-600 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-300",
    green: "border-emerald-200 bg-emerald-50/30 text-emerald-600 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300",
    orange: "border-amber-200 bg-amber-50/40 text-amber-600 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300",
    red: "border-rose-200 bg-rose-50/30 text-rose-600 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300",
    violet: "border-violet-200 bg-violet-50/30 text-violet-600 dark:border-violet-900/70 dark:bg-violet-950/30 dark:text-violet-300",
  }[tone];

  return (
    <article className={cn("rounded-2xl border bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900", styles)}>
      <div className="flex items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-current/10">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 truncate text-2xl font-bold text-slate-950 dark:text-slate-100">{value}</p>
          <p className="mt-2 truncate text-xs font-semibold text-slate-500 dark:text-slate-400">{detail}</p>
        </div>
      </div>
    </article>
  );
}

function ChartPanel({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-4 text-base font-semibold text-slate-950 dark:text-slate-100">{title}</h3>
      {children}
    </article>
  );
}

function DepositDataGrid({ onRefund, rows }: { onRefund: (reservationId: number) => void; rows: DepositRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1180px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-950 dark:text-slate-400">
          <tr>
            <DepositHead>Client</DepositHead>
            <DepositHead>Réservation</DepositHead>
            <DepositHead>Date versement</DepositHead>
            <DepositHead>Montant</DepositHead>
            <DepositHead>Remboursé le</DepositHead>
            <DepositHead>Statut</DepositHead>
            <DepositHead>Montant remboursé</DepositHead>
            <DepositHead>Restant</DepositHead>
            <DepositHead className="text-right">Actions</DepositHead>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {rows.length === 0 ? (
            <tr>
              <td className="px-5 py-12 text-center text-slate-500 dark:text-slate-400" colSpan={9}>
                Aucune caution ne correspond à la recherche.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60" key={row.id}>
                <DepositCell>
                  <div className="flex items-center gap-3">
                    <ClientAvatar name={row.client?.fullName ?? "Client"} />
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{row.client ? normalizeClientName(row.client.fullName) : "Client inconnu"}</p>
                      <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">{getClientIdentity(row.client)}</p>
                    </div>
                  </div>
                </DepositCell>
                <DepositCell>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{row.reservationCode}</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{row.car ? formatCarName(row.car.brand, row.car.model) : "Voiture inconnue"}</p>
                </DepositCell>
                <DepositCell>{formatDateLine(row.depositPayment?.paymentDate)}</DepositCell>
                <DepositCell>
                  <MoneyPill tone="orange" value={row.depositPaid} />
                </DepositCell>
                <DepositCell>{row.refundedAt ? formatDateLine(row.refundedAt) : "-"}</DepositCell>
                <DepositCell>
                  <DepositStatusBadge status={row.status} />
                </DepositCell>
                <DepositCell>
                  <span className="font-bold text-emerald-600 dark:text-emerald-300">{formatMoney(row.refundedAmount)}</span>
                </DepositCell>
                <DepositCell>
                  <MoneyPill tone={row.remaining > 0 ? "red" : "green"} value={row.remaining} />
                </DepositCell>
                <DepositCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {row.depositPayment ? (
                      <Button asChild className="h-9 w-9 rounded-xl" size="icon" title="Voir" variant="ghost">
                        <Link to={`/payments/${row.depositPayment.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    ) : (
                      <Button className="h-9 w-9 rounded-xl" disabled size="icon" title="Voir" variant="ghost">
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    <Button className="h-9 w-9 rounded-xl" size="icon" title="Historique" type="button" variant="ghost">
                      <History className="h-4 w-4" />
                    </Button>
                    <Button
                      className="h-9 w-9 rounded-xl text-emerald-600 hover:text-emerald-700 disabled:text-slate-300"
                      disabled={row.remaining <= 0}
                      onClick={() => onRefund(row.reservation.id)}
                      size="icon"
                      title="Rembourser"
                      type="button"
                      variant="ghost"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                </DepositCell>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function DepositPagination({
  currentPage,
  onPageChange,
  totalPages,
}: {
  currentPage: number;
  onPageChange: (page: number) => void;
  totalPages: number;
}) {
  return (
    <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
      <Button className="h-9 rounded-xl" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)} type="button" variant="outline">
        Précédent
      </Button>
      {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
        <Button
          className={cn(
            "h-9 w-9 rounded-xl",
            currentPage === page
              ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
              : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
          )}
          key={page}
          onClick={() => onPageChange(page)}
          type="button"
          variant="outline"
        >
          {page}
        </Button>
      ))}
      <Button className="h-9 rounded-xl" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)} type="button" variant="outline">
        Suivant
      </Button>
    </div>
  );
}

function DepositEmptyState({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex min-h-[62vh] flex-col items-center justify-center text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-100 text-slate-400 dark:bg-slate-900 dark:text-slate-500">
        <ShieldOff className="h-10 w-10" />
      </span>
      <h3 className="mt-5 text-xl font-semibold text-slate-950 dark:text-slate-100">Aucune caution trouvée</h3>
      <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
        Les cautions encaissées apparaîtront ici avec leurs remboursements, montants restants et statuts.
      </p>
      <Button className="mt-6 rounded-xl" onClick={onBack} type="button">
        Retour aux paiements
      </Button>
    </div>
  );
}

function ModernTooltip({ active, payload, label }: { active?: boolean; label?: string; payload?: Array<{ color?: string; name?: string; value?: number }> }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 p-3 text-xs shadow-xl backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
      <p className="mb-2 font-semibold text-slate-900 dark:text-slate-100">{label}</p>
      <div className="space-y-1">
        {payload.map((item) => (
          <div className="flex items-center justify-between gap-6" key={item.name}>
            <span className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name}
            </span>
            <span className="font-bold text-slate-900 dark:text-slate-100">{formatMoney(Number(item.value ?? 0))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DepositHead({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-5 py-3 font-bold", className)}>{children}</th>;
}

function DepositCell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-5 py-3 align-middle", className)}>{children}</td>;
}

function DepositStatusBadge({ status }: { status: DepositStatus }) {
  const classes = {
    Bloquée: "bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:ring-orange-900",
    Partielle: "bg-yellow-50 text-yellow-700 ring-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-300 dark:ring-yellow-900",
    Remboursée: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900",
  }[status];

  return <span className={cn("inline-flex rounded-lg px-2.5 py-1 text-xs font-bold ring-1", classes)}>{status}</span>;
}

function MoneyPill({ tone, value }: { tone: "green" | "orange" | "red"; value: number }) {
  const classes = {
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900",
    orange: "bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:ring-orange-900",
    red: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900",
  }[tone];

  return <span className={cn("inline-flex rounded-lg px-2.5 py-1 text-xs font-bold ring-1", classes)}>{formatMoney(value)}</span>;
}

function ClientAvatar({ name }: { name: string }) {
  const normalized = normalizeClientName(name);
  const initials = normalized
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const palette = [
    "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
    "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  ];

  return (
    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold", palette[normalized.length % palette.length])}>
      {initials || "CL"}
    </span>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn("h-2.5 w-2.5 rounded-full", className)} />
      {label}
    </span>
  );
}

function DonutLegend({ color, label, percent, value }: { color: string; label: string; percent: number; value: number }) {
  return (
    <div className="flex items-start gap-3">
      <span className={cn("mt-1.5 h-2.5 w-2.5 rounded-full", color)} />
      <div>
        <p className="font-semibold text-slate-700 dark:text-slate-200">{label}</p>
        <p className="mt-1 font-bold text-slate-900 dark:text-slate-100">
          {formatMoney(value)} ({formatPercent(percent)})
        </p>
      </div>
    </div>
  );
}

function buildDepositRows(
  reservations: Reservation[],
  payments: Payment[],
  clientsById: Map<number, Client>,
  carsById: Map<number, Car>,
): DepositRow[] {
  const now = Date.now();

  return reservations
    .map((reservation): DepositRow | null => {
      const reservationPayments = payments.filter((payment) => payment.reservationId === reservation.id);
      const depositPayments = reservationPayments.filter((payment) => payment.type === "DEPOSIT");
      const refundPayments = reservationPayments.filter((payment) => payment.type === "DEPOSIT_REFUND");
      const depositPaid = depositPayments.reduce((sum, payment) => sum + payment.amount, 0);

      if (depositPaid <= 0) return null;

      const refundedAmount = refundPayments.reduce((sum, payment) => sum + payment.amount, 0);
      const remaining = Math.max(0, depositPaid - refundedAmount);
      const refundedAt = [...refundPayments].sort((first, second) => new Date(second.paymentDate).getTime() - new Date(first.paymentDate).getTime())[0]?.paymentDate;
      const depositPayment = [...depositPayments].sort((first, second) => new Date(first.paymentDate).getTime() - new Date(second.paymentDate).getTime())[0];
      const status: DepositStatus = remaining <= 0 ? "Remboursée" : refundedAmount > 0 ? "Partielle" : "Bloquée";

      return {
        car: carsById.get(reservation.carId),
        client: clientsById.get(reservation.clientId),
        depositPaid,
        depositPayment,
        id: reservation.id,
        isLate: remaining > 0 && new Date(reservation.endDate).getTime() < now,
        refundedAmount,
        refundedAt,
        remaining,
        reservation,
        reservationCode: formatReservationCode(reservation.id),
        status,
      };
    })
    .filter((row): row is DepositRow => Boolean(row))
    .sort((first, second) => new Date(second.depositPayment?.paymentDate ?? second.reservation.createdAt).getTime() - new Date(first.depositPayment?.paymentDate ?? first.reservation.createdAt).getTime());
}

function buildDepositStats(rows: DepositRow[]) {
  const totalPaid = rows.reduce((sum, row) => sum + row.depositPaid, 0);
  const totalRefunded = rows.reduce((sum, row) => sum + row.refundedAmount, 0);

  return {
    count: rows.length,
    lateCount: rows.filter((row) => row.isLate).length,
    totalPaid,
    totalRefunded,
    totalRemaining: Math.max(0, totalPaid - totalRefunded),
  };
}

function buildChartData(rows: DepositRow[]): ChartPoint[] {
  const events = rows.flatMap((row) => [
    ...(row.depositPayment ? [{ date: row.depositPayment.paymentDate, paid: row.depositPaid, refunded: 0 }] : []),
    ...(row.refundedAt ? [{ date: row.refundedAt, paid: 0, refunded: row.refundedAmount }] : []),
  ]);

  const grouped = new Map<string, { paid: number; refunded: number; sortKey: number }>();
  events.forEach((event) => {
    const date = new Date(event.date);
    const key = date.toISOString().slice(0, 10);
    const current = grouped.get(key) ?? { paid: 0, refunded: 0, sortKey: date.getTime() };
    grouped.set(key, {
      paid: current.paid + event.paid,
      refunded: current.refunded + event.refunded,
      sortKey: Math.min(current.sortKey, date.getTime()),
    });
  });

  let cumulativePaid = 0;
  let cumulativeRefunded = 0;

  return [...grouped.entries()]
    .sort((first, second) => first[1].sortKey - second[1].sortKey)
    .map(([key, value]) => {
      cumulativePaid += value.paid;
      cumulativeRefunded += value.refunded;
      return {
        label: formatShortChartDate(key),
        paid: cumulativePaid,
        refunded: cumulativeRefunded,
        sortKey: value.sortKey,
      };
    });
}

function exportDepositRows(rows: DepositRow[]) {
  const header = ["Client", "Reservation", "Date versement", "Montant", "Rembourse le", "Statut", "Montant rembourse", "Restant"];
  const body = rows.map((row) => [
    normalizeClientName(row.client?.fullName ?? "Client inconnu"),
    row.reservationCode,
    formatDateValue(row.depositPayment?.paymentDate),
    String(row.depositPaid),
    formatDateValue(row.refundedAt),
    row.status,
    String(row.refundedAmount),
    String(row.remaining),
  ]);
  const csv = [header, ...body].map((line) => line.map(escapeCsvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `cautions_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function formatReservationCode(id: number) {
  return `RES-2026-${String(id).padStart(4, "0")}`;
}

function formatDateLine(value?: string) {
  if (!value) return "-";
  return (
    <span>
      <span className="block font-semibold text-slate-800 dark:text-slate-100">{formatDateValue(value)}</span>
      <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{formatTimeValue(value)}</span>
    </span>
  );
}

function formatDateValue(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatTimeValue(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatShortChartDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function formatCompactMoney(value: number) {
  if (value >= 1000) return `${Math.round(value / 1000)}K`;
  return String(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(2).replace(".", ",")}%`;
}

function getClientIdentity(client?: Client) {
  if (!client) return "CIN : -";
  if (client.cin) return `CIN : ${client.cin}`;
  if (client.passportNumber) return `Passeport : ${client.passportNumber}`;
  return "CIN : -";
}
