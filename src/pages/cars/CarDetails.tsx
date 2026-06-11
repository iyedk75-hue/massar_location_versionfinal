import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  Archive,
  ArrowLeft,
  Calendar,
  CalendarDays,
  Car as CarIcon,
  CircleDollarSign,
  Eye,
  Fuel,
  Gauge,
  Hash,
  PackageOpen,
  Pencil,
  Settings2,
  ShieldCheck,
  Trash2,
  Wrench,
} from "lucide-react";
import { getStatusLabel, StatusBadge } from "@/components/StatusBadge";
import { DataGridActionMenu } from "@/components/ui/action-menu/DataGridActionMenu";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb, BreadcrumbItem, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getCars } from "@/services/car.service";
import { getClients } from "@/services/client.service";
import { getReservations } from "@/services/reservation.service";
import type { Car } from "@/types/car";
import type { Client } from "@/types/client";
import type { Reservation } from "@/types/reservation";
import { cn } from "@/lib/utils";
import { formatCarName, formatRegistrationNumber } from "@/utils/car";
import { normalizeClientName } from "@/utils/client";
import { formatDateTime, formatShortPeriod } from "@/utils/date";
import { formatMoney } from "@/utils/money";

export function CarDetails() {
  const navigate = useNavigate();
  const { carId } = useParams();
  const numericCarId = Number(carId);
  const [cars, setCars] = useState<Car[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void reload();
  }, []);

  async function reload() {
    try {
      setLoading(true);
      const [carsData, clientsData, reservationsData] = await Promise.all([getCars(), getClients(), getReservations()]);
      setCars(carsData);
      setClients(clientsData);
      setReservations(reservationsData);
    } finally {
      setLoading(false);
    }
  }

  const car = useMemo(() => cars.find((item) => item.id === numericCarId), [cars, numericCarId]);
  const clientsById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const carReservations = useMemo(
    () =>
      reservations
        .filter((reservation) => reservation.carId === numericCarId)
        .sort((first, second) => new Date(second.startDate).getTime() - new Date(first.startDate).getTime()),
    [numericCarId, reservations],
  );
  const stats = useMemo(() => {
    const completed = carReservations.filter((reservation) => reservation.status === "COMPLETED").length;
    const ongoing = carReservations.filter((reservation) => reservation.status === "ONGOING").length;
    const totalAmount = carReservations
      .filter((reservation) => reservation.status !== "CANCELLED")
      .reduce((sum, reservation) => sum + reservation.totalPrice, 0);

    return { completed, ongoing, total: carReservations.length, totalAmount };
  }, [carReservations]);

  if (loading) {
    return <StateCard title="Chargement du véhicule" description="Récupération des informations de la flotte." />;
  }

  if (!car) {
    return (
      <div className="space-y-5">
        <Button className="w-fit" onClick={() => navigate("/cars")} type="button" variant="outline">
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>
        <StateCard title="Voiture introuvable" description="Cette voiture n'existe pas ou a été supprimée." />
      </div>
    );
  }

  const carName = formatCarName(car.brand, car.model);

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-3">
          <Breadcrumb>
            <BreadcrumbItem>
              <Link className="transition-smooth hover:text-primary" to="/cars">
                Véhicules
              </Link>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem className="truncate text-foreground">{carName}</BreadcrumbItem>
          </Breadcrumb>

          <div>
            <h1 className="truncate text-2xl font-semibold tracking-normal text-slate-950 dark:text-slate-100">{carName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{formatRegistrationNumber(car.registrationNumber)}</p>
          </div>
        </div>

        <Button className="h-10 w-fit rounded-lg" onClick={() => navigate("/cars")} type="button" variant="outline">
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>
      </div>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_360px]">
        <VehicleHeroCard car={car} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <KpiCard icon={Calendar} label="Total des réservations" tone="blue" value={String(stats.total)} />
          <KpiCard icon={CarIcon} label="Locations terminées" tone="green" value={String(stats.completed)} />
          <KpiCard icon={Fuel} label="Locations en cours" tone="orange" value={String(stats.ongoing)} />
          <KpiCard icon={Gauge} label="Montant total" tone="violet" value={formatMoney(stats.totalAmount)} />
        </div>
      </section>

      <VehicleInfoCard car={car} />

      <RelatedReservationsCard
        clientsById={clientsById}
        onOpenReservations={() => navigate(`/reservations?carId=${car.id}&view=list`)}
        reservations={carReservations}
      />
    </div>
  );
}

function VehicleHeroCard({ car }: { car: Car }) {
  const carName = formatCarName(car.brand, car.model);
  const quickSpecs = [
    { label: "Marque", value: car.brand },
    { label: "Modèle", value: car.model },
    { label: "Carburant", value: car.fuelType },
    { label: "Transmission", value: car.transmission },
  ];

  return (
    <Card className="overflow-hidden p-0">
      <div className="grid min-h-[300px] gap-0 lg:grid-cols-[minmax(280px,0.92fr)_1fr]">
        <div className="bg-slate-100 p-3 dark:bg-slate-900">
          {car.imageUrl ? (
            <img alt={carName} className="h-72 w-full rounded-lg object-cover lg:h-full" src={car.imageUrl} />
          ) : (
            <div className="flex h-72 w-full items-center justify-center rounded-lg bg-slate-200 text-slate-500 ring-1 ring-slate-200 lg:h-full dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700">
              <CarIcon className="h-16 w-16" />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col justify-between gap-8 p-5 sm:p-6">
          <div className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge variant={car.status === "AVAILABLE" ? "success" : "secondary"}>{getStatusLabel(car.status)}</Badge>
              <Badge className="gap-1.5" variant="outline">
                <Hash className="h-3.5 w-3.5" />
                {car.id}
              </Badge>
            </div>

            <h2 className="truncate text-3xl font-semibold tracking-normal text-slate-950 dark:text-slate-100">{carName}</h2>
            <p className="mt-2 text-base font-medium text-muted-foreground">{formatRegistrationNumber(car.registrationNumber)}</p>
          </div>

          <div className="flex flex-col gap-4 rounded-lg border border-border bg-slate-50/70 p-4 sm:flex-row sm:items-center dark:bg-slate-900/60">
            {quickSpecs.map((item, index) => (
              <div className="flex min-w-0 flex-1 items-center gap-4" key={item.label}>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-muted-foreground">{item.label}</p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-950 dark:text-slate-100">{item.value || "-"}</p>
                </div>
                {index < quickSpecs.length - 1 && <Separator className="hidden h-10 sm:block" orientation="vertical" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function KpiCard({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: LucideIcon;
  label: string;
  tone: "blue" | "green" | "orange" | "violet";
  value: string;
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-600 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-200 dark:ring-blue-900",
    green: "bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900",
    orange: "bg-amber-50 text-amber-600 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900",
    violet: "bg-violet-50 text-violet-600 ring-violet-100 dark:bg-violet-950/40 dark:text-violet-200 dark:ring-violet-900",
  };

  return (
    <Card className="flex min-w-0 items-center gap-4 p-4">
      <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ring-1", tones[tone])}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-2xl font-semibold leading-none text-slate-950 dark:text-slate-100">{value}</p>
        <p className="mt-2 truncate text-sm font-medium text-muted-foreground">{label}</p>
      </div>
    </Card>
  );
}

function VehicleInfoCard({ car }: { car: Car }) {
  const items = [
    { icon: Fuel, label: "Carburant", value: car.fuelType },
    { icon: Settings2, label: "Transmission", value: car.transmission },
    { icon: CalendarDays, label: "Année", value: car.year ? String(car.year) : "-" },
    { icon: Gauge, label: "Kilométrage", value: formatMileage(car.mileage) },
    { icon: CircleDollarSign, label: "Prix par jour", value: formatMoney(car.dailyPrice) },
    { icon: ShieldCheck, label: "Assurance", value: formatOptionalDate(car.insuranceExpiryDate) },
    { icon: Wrench, label: "Visite technique", value: formatOptionalDate(car.technicalVisitExpiryDate) },
    { icon: Calendar, label: "Créé le", value: formatDateTime(car.createdAt) },
  ];

  return (
    <Card className="p-0">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold text-slate-950 dark:text-slate-100">Informations du véhicule</h2>
      </div>
      <div className="grid gap-0 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <InfoCell icon={item.icon} key={item.label} label={item.label} value={item.value} />
        ))}
      </div>
    </Card>
  );
}

function InfoCell({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="min-w-0 border-b border-border px-5 py-4 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 xl:border-r xl:[&:nth-child(4n)]:border-r-0 xl:[&:nth-last-child(-n+4)]:border-b-0">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-muted-foreground">{label}</p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-950 dark:text-slate-100">{value}</p>
        </div>
      </div>
    </div>
  );
}

function RelatedReservationsCard({
  clientsById,
  onOpenReservations,
  reservations,
}: {
  clientsById: Map<number, Client>;
  onOpenReservations: () => void;
  reservations: Reservation[];
}) {
  const latestReservations = reservations.slice(0, 5);

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-col gap-4 border-b border-border px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950 dark:text-slate-100">Réservations liées</h2>
          <p className="mt-1 text-sm text-muted-foreground">Historique complet des réservations de cette voiture.</p>
        </div>
        <Button className="w-fit" onClick={onOpenReservations} type="button" variant="outline">
          Voir toutes les réservations
        </Button>
      </div>

      {latestReservations.length === 0 ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
            <PackageOpen className="h-7 w-7" />
          </span>
          <p className="mt-5 text-sm font-semibold text-slate-950 dark:text-slate-100">Aucune réservation liée à ce véhicule.</p>
          <p className="mt-1 text-sm text-muted-foreground">Les réservations apparaîtront ici.</p>
        </div>
      ) : (
        <div className="w-full overflow-x-auto md:overflow-x-visible">
          <table className="w-full min-w-[860px] table-fixed text-left text-sm md:min-w-0">
            <thead className="bg-slate-50 text-xs uppercase text-muted-foreground dark:bg-slate-900/70">
              <tr>
                <TableHead className="min-w-0">Client</TableHead>
                <TableHead className="w-[148px] lg:w-[174px]">Période</TableHead>
                <TableHead className="w-[132px] lg:w-[154px]">Départ</TableHead>
                <TableHead className="w-[132px] lg:w-[154px]">Retour</TableHead>
                <TableHead className="w-[96px] lg:w-[118px]">Montant</TableHead>
                <TableHead className="w-[112px] lg:w-[132px]">Statut</TableHead>
                <TableHead className="w-[82px] text-right lg:w-[96px]">Actions</TableHead>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {latestReservations.map((reservation) => {
                const client = clientsById.get(reservation.clientId) ?? reservation.client;
                return (
                  <tr className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-900/70" key={reservation.id}>
                    <TableCell className="min-w-0 overflow-hidden">
                      <p className="truncate font-semibold text-slate-950 dark:text-slate-100">
                        {client ? normalizeClientName(client.fullName) : `Client #${reservation.clientId}`}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">Réservation #{reservation.id}</p>
                    </TableCell>
                    <TableCell className="overflow-hidden whitespace-nowrap">
                      <span className="block truncate">{formatShortPeriod(reservation.startDate, reservation.endDate)}</span>
                    </TableCell>
                    <TableCell className="overflow-hidden whitespace-nowrap">
                      <span className="block truncate">{formatDateTime(reservation.startDate)}</span>
                    </TableCell>
                    <TableCell className="overflow-hidden whitespace-nowrap">
                      <span className="block truncate">{formatDateTime(reservation.endDate)}</span>
                    </TableCell>
                    <TableCell className="overflow-hidden whitespace-nowrap font-semibold">
                      <span className="block truncate">{formatMoney(reservation.totalPrice)}</span>
                    </TableCell>
                    <TableCell className="overflow-hidden">
                      <StatusBadge status={reservation.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end">
                        <DataGridActionMenu
                          actions={[
                            { icon: Eye, label: "Voir détails", onClick: onOpenReservations },
                            { icon: Pencil, label: "Modifier", onClick: onOpenReservations },
                            { disabled: true, icon: Archive, label: "Archiver" },
                            { destructive: true, disabled: true, icon: Trash2, label: "Supprimer" },
                          ]}
                        />
                      </div>
                    </TableCell>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function StateCard({ description, title }: { description: string; title: string }) {
  return (
    <Card className="flex min-h-[280px] items-center justify-center text-center">
      <div>
        <p className="font-semibold text-slate-950 dark:text-slate-100">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </Card>
  );
}

function TableHead({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-3 py-3 font-semibold", className)}>{children}</th>;
}

function TableCell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-3 py-4 align-middle", className)}>{children}</td>;
}

function formatMileage(value?: number | null) {
  if (!Number.isFinite(value)) return "-";
  return `${new Intl.NumberFormat("fr-TN", { maximumFractionDigits: 0 }).format(Number(value))} km`;
}

function formatOptionalDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
