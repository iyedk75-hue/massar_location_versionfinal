import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, CarFront, FileText, IdCard, Phone, UserRound } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Breadcrumb, BreadcrumbItem, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCars } from "@/services/car.service";
import { getClients } from "@/services/client.service";
import { getReservations } from "@/services/reservation.service";
import type { Car } from "@/types/car";
import type { Client } from "@/types/client";
import type { Reservation } from "@/types/reservation";
import { cn } from "@/lib/utils";
import { formatCarName, formatRegistrationNumber } from "@/utils/car";
import { formatDrivingLicense, formatPhoneNumber, normalizeClientName } from "@/utils/client";
import { formatDateTime } from "@/utils/date";
import { formatMoney } from "@/utils/money";

export function ClientDetails() {
  const { clientId } = useParams();
  const numericClientId = Number(clientId);
  const [clients, setClients] = useState<Client[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void reload();
  }, []);

  async function reload() {
    try {
      setLoading(true);
      const [clientsData, reservationsData, carsData] = await Promise.all([getClients(), getReservations(), getCars()]);
      setClients(clientsData);
      setReservations(reservationsData);
      setCars(carsData);
    } finally {
      setLoading(false);
    }
  }

  const client = useMemo(() => clients.find((item) => item.id === numericClientId), [clients, numericClientId]);
  const carsById = useMemo(() => new Map(cars.map((car) => [car.id, car])), [cars]);
  const clientReservations = useMemo(
    () =>
      reservations
        .filter((reservation) => reservation.clientId === numericClientId || reservation.secondClientId === numericClientId)
        .sort((first, second) => new Date(second.startDate).getTime() - new Date(first.startDate).getTime()),
    [numericClientId, reservations],
  );
  const stats = useMemo(() => {
    const completed = clientReservations.filter((reservation) => reservation.status === "COMPLETED").length;
    const ongoing = clientReservations.filter((reservation) => reservation.status === "ONGOING").length;
    const totalAmount = clientReservations
      .filter((reservation) => reservation.status !== "CANCELLED")
      .reduce((sum, reservation) => sum + reservation.totalPrice, 0);

    return { completed, ongoing, total: clientReservations.length, totalAmount };
  }, [clientReservations]);

  if (loading) {
    return <div className="rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">Chargement du client...</div>;
  }

  if (!client) {
    return (
      <div className="space-y-4">
        <Button asChild className="w-fit" variant="outline">
          <Link to="/clients">
            <ArrowLeft className="h-4 w-4" />
            Retour clients
          </Link>
        </Button>
        <Card>
          <p className="font-semibold text-slate-950">Client introuvable</p>
          <p className="mt-1 text-sm text-muted-foreground">Ce client n'existe pas ou a ete supprime.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Breadcrumb>
            <BreadcrumbItem>
              <Link className="transition-smooth hover:text-primary" to="/clients">
                Clients
              </Link>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem className="truncate text-foreground">{normalizeClientName(client.fullName)}</BreadcrumbItem>
          </Breadcrumb>
        </div>

        <Button asChild className="h-10 w-fit rounded-lg" variant="outline">
          <Link to="/clients">
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Link>
        </Button>
      </div>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-0">
          <div className="border-b border-border p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <ClientAvatar name={client.fullName} />
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-semibold text-slate-950">{normalizeClientName(client.fullName)}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{getClientIdentity(client)}</p>
                </div>
              </div>
              <ClientStatusBadge active={client.isActive !== false} />
            </div>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-2">
            <InfoItem icon={Phone} label="Telephone" value={formatPhoneNumber(client.phone)} />
            <InfoItem icon={IdCard} label="Permis" value={formatDrivingLicense(client.drivingLicense)} />
            <InfoItem icon={FileText} label="CIN" value={client.cin || "-"} />
            <InfoItem icon={FileText} label="Passeport" value={client.passportNumber || "-"} />
            <InfoItem label="Date naissance" value={formatOptionalDate(client.birthDate)} />
            <InfoItem label="Lieu naissance" value={client.birthPlace || "-"} />
            <InfoItem label="Nationalite" value={client.nationality || "-"} />
            <InfoItem label="Adresse" value={client.address || "-"} />
            <InfoItem label="Date permis" value={formatOptionalDate(client.drivingLicenseDate)} />
            <InfoItem label="CIN delivree le" value={formatOptionalDate(client.cinIssueDate)} />
            <InfoItem label="Lieu CIN" value={client.cinIssuePlace || "-"} />
            <InfoItem label="Cree le" value={formatDateTime(client.createdAt)} />
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <StatCard icon={CalendarDays} label="Reservations" value={String(stats.total)} />
          <StatCard icon={CarFront} label="Locations terminees" value={String(stats.completed)} />
          <StatCard icon={UserRound} label="Locations en cours" value={String(stats.ongoing)} />
          <StatCard icon={FileText} label="Montant total" value={formatMoney(stats.totalAmount)} />
        </div>
      </section>

      <Card className="p-0">
        <div className="border-b border-border p-5">
          <h2 className="text-base font-semibold text-slate-950">Reservations du client</h2>
          <p className="mt-1 text-sm text-muted-foreground">Historique complet comme client principal ou deuxieme conducteur.</p>
        </div>
        <div className="w-full overflow-x-auto md:overflow-x-visible">
          <table className="w-full min-w-[640px] table-fixed text-sm md:min-w-0">
            <thead>
              <tr className="border-b border-border bg-slate-50 dark:bg-slate-950">
                <TableHead className="w-[300px] lg:w-[360px]">Voiture</TableHead>
                <TableHead className="w-[132px] lg:w-[154px]">Départ</TableHead>
                <TableHead className="w-[132px] lg:w-[154px]">Retour</TableHead>
                <TableHead className="w-[96px] lg:w-[118px]">Montant</TableHead>
                <TableHead className="w-[112px] lg:w-[132px]">Statut</TableHead>
              </tr>
            </thead>
            <tbody>
              {clientReservations.length ? (
                clientReservations.map((reservation) => {
                  const car = carsById.get(reservation.carId) ?? reservation.car;
                  return (
                    <tr
                      className="border-b border-border last:border-0 transition hover:bg-slate-50/60 dark:hover:bg-slate-950/40"
                      key={reservation.id}
                    >
                      <TableCell className="w-[300px] min-w-0 overflow-hidden lg:w-[360px]">
                        <ReservationCarCell car={car} reservation={reservation} />
                      </TableCell>
                      <TableCell className="overflow-hidden whitespace-nowrap">
                        <DateTimeCell value={reservation.startDate} />
                      </TableCell>
                      <TableCell className="overflow-hidden whitespace-nowrap">
                        <DateTimeCell value={reservation.endDate} />
                      </TableCell>
                      <TableCell className="overflow-hidden whitespace-nowrap font-semibold">
                        <span className="block truncate">{formatMoney(reservation.totalPrice)}</span>
                      </TableCell>
                      <TableCell className="overflow-hidden">
                        <StatusBadge status={reservation.status} />
                      </TableCell>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="px-5 py-10 text-center text-muted-foreground" colSpan={5}>
                    Aucune reservation pour ce client.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ClientAvatar({ name }: { name: string }) {
  const initials = normalizeClientName(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">{initials || "CL"}</span>;
}

function ClientStatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
        active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-rose-200",
      )}
    >
      {active ? "Actif" : "Inactif"}
    </span>
  );
}

function ReservationCarCell({ car, reservation }: { car?: Car; reservation: Reservation }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-800">
        <CarFront className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{car ? formatCarName(car.brand, car.model) : `Voiture #${reservation.carId}`}</p>
        <p className="truncate text-xs text-muted-foreground">{car ? formatRegistrationNumber(car.registrationNumber) : "-"}</p>
      </div>
    </div>
  );
}

function DateTimeCell({ value }: { value: string }) {
  const dateTime = formatDateLine(value);

  return (
    <>
      <p className="truncate text-sm text-foreground">{dateTime.date}</p>
      <p className="truncate text-xs text-muted-foreground">{dateTime.time}</p>
    </>
  );
}

function TableHead({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cn("px-2 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground", className)}>
      {children}
    </th>
  );
}

function TableCell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-2 py-3 align-middle", className)}>{children}</td>;
}

function formatDateLine(value: string) {
  const date = new Date(value);

  return {
    date: new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(date),
    time: new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(date),
  };
}

function InfoItem({ icon: Icon, label, value }: { icon?: typeof Phone; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-50 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
        {Icon && <Icon className="h-4 w-4 text-blue-600" />}
        {label}
      </div>
      <p className="mt-1 break-words font-medium text-slate-950">{value}</p>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return (
    <Card className="flex items-center gap-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-xl font-semibold text-slate-950">{value}</p>
      </div>
    </Card>
  );
}

function getClientIdentity(client: Client) {
  if (client.cin) return `CIN : ${client.cin}`;
  if (client.passportNumber) return `Passeport : ${client.passportNumber}`;
  return "Piece d'identite : -";
}

function formatOptionalDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
