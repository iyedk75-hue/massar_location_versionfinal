import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Car as CarIcon, Fuel, Gauge, ShieldCheck, Wrench } from "lucide-react";
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
import { formatCarName, formatRegistrationNumber } from "@/utils/car";
import { normalizeClientName } from "@/utils/client";
import { formatDateTime, formatShortPeriod } from "@/utils/date";
import { formatMoney } from "@/utils/money";

export function CarDetails() {
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
    return <div className="rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">Chargement de la voiture...</div>;
  }

  if (!car) {
    return (
      <div className="space-y-4">
        <Button asChild className="w-fit" variant="outline">
          <Link to="/cars">
            <ArrowLeft className="h-4 w-4" />
            Retour voitures
          </Link>
        </Button>
        <Card>
          <p className="font-semibold text-slate-950">Voiture introuvable</p>
          <p className="mt-1 text-sm text-muted-foreground">Cette voiture n'existe pas ou a ete supprimee.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title={formatCarName(car.brand, car.model)}>
        <Button asChild className="h-11 rounded-lg" variant="outline">
          <Link to="/cars">
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
                {car.imageUrl ? (
                  <img alt={formatCarName(car.brand, car.model)} className="h-20 w-28 rounded-lg object-cover" src={car.imageUrl} />
                ) : (
                  <span className="flex h-20 w-28 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <CarIcon className="h-9 w-9" />
                  </span>
                )}
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-semibold text-slate-950">{formatCarName(car.brand, car.model)}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{formatRegistrationNumber(car.registrationNumber)}</p>
                </div>
              </div>
              <StatusBadge status={car.status} />
            </div>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-2">
            <InfoItem icon={Fuel} label="Carburant" value={car.fuelType} />
            <InfoItem icon={CarIcon} label="Transmission" value={car.transmission} />
            <InfoItem icon={CalendarDays} label="Annee" value={car.year ? String(car.year) : "-"} />
            <InfoItem icon={Gauge} label="Kilometrage" value={formatMileage(car.mileage)} />
            <InfoItem label="Prix par jour" value={formatMoney(car.dailyPrice)} />
            <InfoItem icon={ShieldCheck} label="Assurance" value={formatOptionalDate(car.insuranceExpiryDate)} />
            <InfoItem icon={Wrench} label="Visite technique" value={formatOptionalDate(car.technicalVisitExpiryDate)} />
            <InfoItem label="Creee le" value={formatDateTime(car.createdAt)} />
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <StatCard icon={CalendarDays} label="Reservations" value={String(stats.total)} />
          <StatCard icon={CarIcon} label="Locations terminees" value={String(stats.completed)} />
          <StatCard icon={Fuel} label="Locations en cours" value={String(stats.ongoing)} />
          <StatCard icon={Gauge} label="Montant total" value={formatMoney(stats.totalAmount)} />
        </div>
      </section>

      <Card className="p-0">
        <div className="border-b border-border p-5">
          <h2 className="text-base font-semibold text-slate-950">Reservations liees</h2>
          <p className="mt-1 text-sm text-muted-foreground">Historique complet des reservations de cette voiture.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Reservation</th>
                <th className="px-5 py-3 font-semibold">Client</th>
                <th className="px-5 py-3 font-semibold">Periode</th>
                <th className="px-5 py-3 font-semibold">Montant</th>
                <th className="px-5 py-3 font-semibold">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {carReservations.length ? (
                carReservations.map((reservation) => {
                  const client = clientsById.get(reservation.clientId) ?? reservation.client;
                  const secondClient = reservation.secondClientId ? clientsById.get(reservation.secondClientId) ?? reservation.secondClient : undefined;
                  return (
                    <tr className="hover:bg-slate-50/80" key={reservation.id}>
                      <td className="px-5 py-4 font-semibold text-slate-900">#{reservation.id}</td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-900">{client ? normalizeClientName(client.fullName) : `Client #${reservation.clientId}`}</p>
                        {secondClient && <p className="mt-0.5 text-xs text-muted-foreground">2e conducteur: {normalizeClientName(secondClient.fullName)}</p>}
                      </td>
                      <td className="px-5 py-4 text-slate-700">{formatShortPeriod(reservation.startDate, reservation.endDate)}</td>
                      <td className="px-5 py-4 font-semibold text-slate-900">{formatMoney(reservation.totalPrice)}</td>
                      <td className="px-5 py-4">
                        <StatusBadge status={reservation.status} />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="px-5 py-10 text-center text-muted-foreground" colSpan={5}>
                    Aucune reservation liee a cette voiture.
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

function InfoItem({ icon: Icon, label, value }: { icon?: typeof CarIcon; label: string; value: string }) {
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
