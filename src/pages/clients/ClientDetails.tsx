import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, CarFront, FileText, IdCard, Phone, UserRound } from "lucide-react";
import { PageHeader } from "@/app/layout";
import { StatusBadge } from "@/components/StatusBadge";
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
import { formatDateTime, formatShortPeriod } from "@/utils/date";
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
      <PageHeader title={normalizeClientName(client.fullName)}>
        <Button asChild className="h-11 rounded-lg" variant="outline">
          <Link to="/clients">
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Link>
        </Button>
      </PageHeader>

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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Reservation</th>
                <th className="px-5 py-3 font-semibold">Voiture</th>
                <th className="px-5 py-3 font-semibold">Periode</th>
                <th className="px-5 py-3 font-semibold">Role</th>
                <th className="px-5 py-3 font-semibold">Montant</th>
                <th className="px-5 py-3 font-semibold">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {clientReservations.length ? (
                clientReservations.map((reservation) => {
                  const car = carsById.get(reservation.carId) ?? reservation.car;
                  return (
                    <tr className="hover:bg-slate-50/80" key={reservation.id}>
                      <td className="px-5 py-4 font-semibold text-slate-900">#{reservation.id}</td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-900">{car ? formatCarName(car.brand, car.model) : `Voiture #${reservation.carId}`}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{car ? formatRegistrationNumber(car.registrationNumber) : "-"}</p>
                      </td>
                      <td className="px-5 py-4 text-slate-700">{formatShortPeriod(reservation.startDate, reservation.endDate)}</td>
                      <td className="px-5 py-4 text-slate-700">{reservation.clientId === client.id ? "Client principal" : "Deuxieme conducteur"}</td>
                      <td className="px-5 py-4 font-semibold text-slate-900">{formatMoney(reservation.totalPrice)}</td>
                      <td className="px-5 py-4">
                        <StatusBadge status={reservation.status} />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="px-5 py-10 text-center text-muted-foreground" colSpan={6}>
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
