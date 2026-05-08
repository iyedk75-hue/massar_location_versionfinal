import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Car as CarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Fuel,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { getStatusLabel, StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CarForm } from "@/pages/cars/CarForm";
import { createCar, deleteCar, getCars, updateCar } from "@/services/car.service";
import { getReservations, updateReservationStatus } from "@/services/reservation.service";
import type { Car, CarStatus, CreateCarDto } from "@/types/car";
import type { Reservation } from "@/types/reservation";
import {
  formatCarName,
  formatRegistrationNumber,
  isValidRegistrationNumber,
  normalizeCarBrand,
  normalizeCarModel,
  normalizeRegistrationNumber,
} from "@/utils/car";
import { formatShortPeriod } from "@/utils/date";
import { formatMoney } from "@/utils/money";
import { useNotifications } from "@/hooks/useNotifications";
import { useToast } from "@/hooks/useToast";

const statuses: Array<"ALL" | CarStatus> = ["ALL", "AVAILABLE", "RENTED", "MAINTENANCE", "UNAVAILABLE"];
const fuelLevels = ["Plein", "3/4", "1/2", "1/4", "Vide"];
const pageSizes = [5, 10, 15, 25];

export function CarsPage() {
  const [cars, setCars] = useState<Car[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | CarStatus>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [open, setOpen] = useState(false);
  const [editingCar, setEditingCar] = useState<Car | null>(null);
  const [detailsCar, setDetailsCar] = useState<Car | null>(null);
  const [retourCar, setRetourCar] = useState<Car | null>(null);
  const [retourMileage, setRetourMileage] = useState<string>("");
  const [retourFuel, setRetourFuel] = useState<string>("Plein");
  const [selectedCarIds, setSelectedCarIds] = useState<number[]>([]);
  const [bulkActionsOpen, setBulkActionsOpen] = useState(false);
  const { push } = useNotifications();
  const { showToast } = useToast();

  useEffect(() => {
    void reload();
  }, []);

  async function reload() {
    const [carsData, reservationsData] = await Promise.all([getCars(), getReservations()]);
    setCars(carsData);
    setReservations(reservationsData);

    const today = Date.now();
    const soon = today + 30 * 24 * 60 * 60 * 1000;
    for (const car of carsData) {
      const carName = formatCarName(car.brand, car.model);

      if (car.insuranceExpiryDate) {
        const time = new Date(car.insuranceExpiryDate).getTime();
        if (Number.isFinite(time)) {
          if (time < today) {
            push({ carId: car.id, message: `${carName} : assurance expirée.`, type: "insurance_expired" });
          } else if (time <= soon) {
            push({ carId: car.id, message: `${carName} : assurance expire bientôt.`, type: "insurance_soon" });
          }
        }
      }

      if (car.technicalVisitExpiryDate) {
        const time = new Date(car.technicalVisitExpiryDate).getTime();
        if (Number.isFinite(time)) {
          if (time < today) {
            push({ carId: car.id, message: `${carName} : visite technique expirée.`, type: "technical_visit_expired" });
          } else if (time <= soon) {
            push({ carId: car.id, message: `${carName} : visite technique expire bientôt.`, type: "technical_visit_soon" });
          }
        }
      }
    }
  }

  const filteredCars = useMemo(
    () =>
      cars.filter((car) => {
        const searchable = `${formatCarName(car.brand, car.model)} ${car.registrationNumber} ${formatRegistrationNumber(
          car.registrationNumber,
        )}`.toLowerCase();
        const matchesSearch = searchable.includes(query.toLowerCase());
        const matchesStatus = status === "ALL" || car.status === status;
        return matchesSearch && matchesStatus;
      }),
    [cars, query, status],
  );

  useEffect(() => {
    setPage(1);
  }, [pageSize, query, status]);

  useEffect(() => {
    setSelectedCarIds((current) => current.filter((id) => cars.some((car) => car.id === id)));
  }, [cars]);

  const ongoingByCarId = useMemo(
    () => new Map(reservations.filter((reservation) => reservation.status === "ONGOING").map((reservation) => [reservation.carId, reservation])),
    [reservations],
  );

  const stats = useMemo(() => {
    const available = cars.filter((car) => car.status === "AVAILABLE").length;
    const rented = cars.filter((car) => car.status === "RENTED").length;
    const maintenance = cars.filter((car) => car.status === "MAINTENANCE").length;
    const createdThisMonth = cars.filter((car) => isInCurrentMonth(car.createdAt)).length;

    return {
      available,
      availablePercent: getPercent(available, cars.length),
      createdThisMonth,
      maintenance,
      maintenancePercent: getPercent(maintenance, cars.length),
      rented,
      rentedPercent: getPercent(rented, cars.length),
      total: cars.length,
    };
  }, [cars]);

  const totalPages = Math.max(1, Math.ceil(filteredCars.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedCars = filteredCars.slice((safePage - 1) * pageSize, safePage * pageSize);
  const firstItem = filteredCars.length ? (safePage - 1) * pageSize + 1 : 0;
  const lastItem = Math.min(safePage * pageSize, filteredCars.length);
  const selectedCarIdsSet = useMemo(() => new Set(selectedCarIds), [selectedCarIds]);
  const selectedCars = useMemo(() => cars.filter((car) => selectedCarIdsSet.has(car.id)), [cars, selectedCarIdsSet]);
  const visibleCarIds = paginatedCars.map((car) => car.id);
  const allVisibleCarsSelected = visibleCarIds.length > 0 && visibleCarIds.every((id) => selectedCarIdsSet.has(id));

  function toggleCarSelection(id: number) {
    setSelectedCarIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleVisibleCars() {
    setSelectedCarIds((current) => {
      if (allVisibleCarsSelected) return current.filter((id) => !visibleCarIds.includes(id));
      return Array.from(new Set([...current, ...visibleCarIds]));
    });
  }

  async function handleSubmit(data: CreateCarDto) {
    try {
      const normalized = normalizeCarPayload(data);
      if (editingCar) {
        const oldMileage = editingCar.mileage ?? 0;
        const newMileage = normalized.mileage ?? 0;
        const car = await updateCar(editingCar.id, normalized);

        if (newMileage > oldMileage && Math.floor(newMileage / 10000) > Math.floor(oldMileage / 10000)) {
          const threshold = Math.floor(newMileage / 10000) * 10000;
          push({
            carId: car.id,
            message: `${formatCarName(car.brand, car.model)} a dépassé ${threshold} km. Vérifiez la révision.`,
            type: "mileage_threshold",
          });
        }

        setCars((current) => current.map((item) => (item.id === car.id ? car : item)));
        showToast({ title: "Voiture modifiée", type: "success" });
      } else {
        const car = await createCar(normalized);
        setCars((current) => [car, ...current]);
        showToast({ title: "Voiture ajoutée", type: "success" });
      }
      setEditingCar(null);
      setOpen(false);
    } catch (caught) {
      showToast({ message: getErrorMessage(caught), title: "Erreur voiture", type: "error" });
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Supprimer cette voiture ?")) return;
    try {
      await deleteCar(id);
      setCars((current) => current.filter((car) => car.id !== id));
      showToast({ title: "Voiture supprimée", type: "success" });
    } catch (caught) {
      showToast({ message: getErrorMessage(caught), title: "Suppression impossible", type: "error" });
    }
  }

  async function handleSelectedCarsDelete() {
    if (!selectedCars.length) {
      showToast({ message: "Cochez au moins une voiture dans la liste.", title: "Aucune sélection", type: "info" });
      setBulkActionsOpen(false);
      return;
    }

    if (!window.confirm(`Supprimer ${selectedCars.length} voiture${selectedCars.length > 1 ? "s" : ""} sélectionnée${selectedCars.length > 1 ? "s" : ""} ?`)) {
      setBulkActionsOpen(false);
      return;
    }

    try {
      await Promise.all(selectedCars.map((car) => deleteCar(car.id)));
      const deletedIds = new Set(selectedCars.map((car) => car.id));

      setCars((current) => current.filter((car) => !deletedIds.has(car.id)));
      setSelectedCarIds([]);
      setBulkActionsOpen(false);
      showToast({ title: "Voitures supprimées", type: "success" });
    } catch (caught) {
      showToast({ message: getErrorMessage(caught), title: "Suppression impossible", type: "error" });
    }
  }

  async function handleRetour() {
    if (!retourCar) return;
    const reservation = ongoingByCarId.get(retourCar.id);
    if (!reservation) return;

    const mileage = retourMileage.trim() ? Number(retourMileage) : undefined;

    if (mileage != null && reservation.pickupMileage != null) {
      if (Math.floor(mileage / 10000) > Math.floor(reservation.pickupMileage / 10000)) {
        const threshold = Math.floor(mileage / 10000) * 10000;
        push({
          carId: retourCar.id,
          message: `${formatCarName(retourCar.brand, retourCar.model)} a dépassé ${threshold} km. Vérifiez la révision.`,
          type: "mileage_threshold",
        });
      }
    }

    try {
      await updateReservationStatus(reservation.id, {
        returnFuelLevel: retourFuel,
        returnMileage: mileage,
        status: "COMPLETED",
      });

      setRetourCar(null);
      await reload();
      showToast({ title: "Retour enregistré", type: "success" });
    } catch (caught) {
      showToast({ message: getErrorMessage(caught), title: "Erreur retour", type: "error" });
    }
  }

  const detailsHistory = reservations.filter((reservation) => reservation.carId === detailsCar?.id);

  return (
    <>
      <div className="space-y-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal text-slate-900">Voitures</h1>
            <p className="mt-1 text-sm text-muted-foreground">Gérez votre flotte de véhicules</p>
          </div>
          <Dialog
            onOpenChange={(value) => {
              setOpen(value);
              if (!value) setEditingCar(null);
            }}
            open={open}
          >
            <DialogTrigger asChild>
              <Button className="h-11 self-start rounded-lg px-5 shadow-sm">
                <Plus className="h-4 w-4" />
                Ajouter voiture
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[92vh] w-[min(96vw,920px)] overflow-y-auto p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle>{editingCar ? "Modifier une voiture" : "Ajouter une voiture"}</DialogTitle>
              </DialogHeader>
              <CarForm
                currentCarId={editingCar?.id}
                defaultValues={editingCar ? carToForm(editingCar) : undefined}
                existingCars={cars}
                onSubmit={handleSubmit}
              />
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FleetStatCard
            accent="blue"
            detail={`+${stats.createdThisMonth} ce mois`}
            icon={CarIcon}
            label="Total voitures"
            value={stats.total}
          />
          <FleetStatCard
            accent="emerald"
            detail={`${stats.availablePercent}%`}
            icon={CheckCircle2}
            label="Disponibles"
            value={stats.available}
          />
          <FleetStatCard accent="amber" detail={`${stats.rentedPercent}%`} icon={Fuel} label="Louées" value={stats.rented} />
          <FleetStatCard
            accent="rose"
            detail={`${stats.maintenancePercent}%`}
            icon={Wrench}
            label="Maintenance"
            value={stats.maintenance}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(280px,1fr)_220px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="h-11 rounded-lg border-slate-200 bg-white pl-10 shadow-sm"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher (immatriculation, marque, modèle...)"
              value={query}
            />
          </div>
          <select
            className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-600 shadow-sm outline-none transition-smooth focus:ring-2 focus:ring-ring focus:ring-offset-2"
            onChange={(event) => setStatus(event.target.value as "ALL" | CarStatus)}
            value={status}
          >
            {statuses.map((item) => (
              <option key={item} value={item}>
                {item === "ALL" ? "Tous les statuts" : getStatusLabel(item)}
              </option>
            ))}
          </select>
          <div className="relative">
            <Button
              className="h-11 w-full rounded-lg border-slate-200 bg-white px-5 shadow-sm"
              onClick={() => setBulkActionsOpen((current) => !current)}
              type="button"
              variant="outline"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filtres
            </Button>
            {bulkActionsOpen && (
              <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                <p className="px-2 pb-2 text-xs font-medium text-slate-500">
                  {selectedCarIds.length} voiture{selectedCarIds.length > 1 ? "s" : ""} sélectionnée{selectedCarIds.length > 1 ? "s" : ""}
                </p>
                <button
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!selectedCarIds.length}
                  onClick={() => void handleSelectedCarsDelete()}
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                  Supprimer sélection
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-100/80 text-xs uppercase text-slate-500">
                <tr>
                  <th className="w-14 px-5 py-4">
                    <input
                      aria-label="Sélectionner les voitures visibles"
                      checked={allVisibleCarsSelected}
                      className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                      disabled={!visibleCarIds.length}
                      onChange={toggleVisibleCars}
                      type="checkbox"
                    />
                  </th>
                  <th className="px-5 py-4 font-semibold">Immatriculation</th>
                  <th className="px-5 py-4 font-semibold">Voiture</th>
                  <th className="px-5 py-4 font-semibold">Carburant</th>
                  <th className="px-5 py-4 font-semibold">Prix/jour</th>
                  <th className="px-5 py-4 font-semibold">Kilométrage</th>
                  <th className="px-5 py-4 font-semibold">Alertes</th>
                  <th className="px-5 py-4 font-semibold">Statut</th>
                  <th className="px-5 py-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedCars.length ? (
                  paginatedCars.map((car) => (
                    <tr
                      className={`transition-colors ${
                        selectedCarIdsSet.has(car.id) ? "bg-blue-50/70 hover:bg-blue-50" : "hover:bg-slate-50/80"
                      }`}
                      key={car.id}
                    >
                      <td className="px-5 py-4">
                        <input
                          aria-label={`Sélectionner ${formatCarName(car.brand, car.model)}`}
                          checked={selectedCarIdsSet.has(car.id)}
                          className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                          onChange={() => toggleCarSelection(car.id)}
                          type="checkbox"
                        />
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-700">
                        <RegistrationNumber value={car.registrationNumber} />
                      </td>
                      <td className="px-5 py-4">
                        <CarIdentity car={car} />
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-700">{car.fuelType}</td>
                      <td className="px-5 py-4 font-semibold text-slate-700">{formatMoney(car.dailyPrice)}</td>
                      <td className="px-5 py-4 text-slate-600">{formatMileage(car.mileage)}</td>
                      <td className="px-5 py-4">
                        <CarAlerts car={car} />
                      </td>
                      <td className="px-5 py-4">
                        <FleetStatusBadge status={car.status} />
                      </td>
                      <td className="px-5 py-4">
                        <CarActions
                          car={car}
                          hasOngoingReservation={ongoingByCarId.has(car.id)}
                          onDelete={() => void handleDelete(car.id)}
                          onEdit={() => {
                            setEditingCar(car);
                            setOpen(true);
                          }}
                          onRetour={() => {
                            setRetourCar(car);
                            setRetourMileage("");
                            setRetourFuel("Plein");
                          }}
                          onView={() => setDetailsCar(car)}
                        />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-5 py-10 text-center text-muted-foreground" colSpan={9}>
                      Aucune voiture trouvée
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-3 text-sm text-muted-foreground xl:flex-row xl:items-center xl:justify-between">
          <p>
            Affichage de {firstItem} à {lastItem} sur {filteredCars.length} voitures
            {selectedCarIds.length > 0 ? ` · ${selectedCarIds.length} sélectionnée${selectedCarIds.length > 1 ? "s" : ""}` : ""}
          </p>
          <div className="flex flex-wrap items-center gap-3 xl:justify-end">
            <Pagination currentPage={safePage} onPageChange={setPage} totalPages={totalPages} />
            <select
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 shadow-sm outline-none transition-smooth focus:ring-2 focus:ring-ring focus:ring-offset-2"
              onChange={(event) => setPageSize(Number(event.target.value))}
              value={pageSize}
            >
              {pageSizes.map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <Dialog onOpenChange={(value) => !value && setDetailsCar(null)} open={Boolean(detailsCar)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Historique de location</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm font-medium">
              {formatCarName(detailsCar?.brand, detailsCar?.model)} - {formatRegistrationNumber(detailsCar?.registrationNumber)}
            </p>
            {detailsHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune location pour cette voiture.</p>
            ) : (
              detailsHistory.map((reservation) => (
                <div className="rounded-md border border-border p-3 text-sm" key={reservation.id}>
                  <div className="flex items-center justify-between">
                    <span>Réservation #{reservation.id}</span>
                    <StatusBadge status={reservation.status} />
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {formatShortPeriod(reservation.startDate, reservation.endDate)} | {formatMoney(reservation.totalPrice)}
                  </p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={(value) => !value && setRetourCar(null)} open={Boolean(retourCar)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retour voiture</DialogTitle>
          </DialogHeader>
          {retourCar && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {formatCarName(retourCar.brand, retourCar.model)} - {formatRegistrationNumber(retourCar.registrationNumber)}
              </p>
              <div>
                <Label>Kilométrage retour (km)</Label>
                <Input
                  min={retourCar.mileage ?? 0}
                  onChange={(event) => setRetourMileage(event.target.value)}
                  placeholder={`Ex: ${(retourCar.mileage ?? 0) + 500}`}
                  type="number"
                  value={retourMileage}
                />
              </div>
              <div>
                <Label>Niveau carburant au retour</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                  onChange={(event) => setRetourFuel(event.target.value)}
                  value={retourFuel}
                >
                  {fuelLevels.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <Button onClick={() => setRetourCar(null)} type="button" variant="outline">
                  Annuler
                </Button>
                <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => void handleRetour()} type="button">
                  <CheckCircle2 className="h-4 w-4" />
                  Confirmer retour
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function normalizeCarPayload(data: CreateCarDto): CreateCarDto {
  return {
    ...data,
    brand: normalizeCarBrand(data.brand),
    imageUrl: data.imageUrl || null,
    insuranceExpiryDate: data.insuranceExpiryDate || null,
    mileage: Number.isFinite(data.mileage) ? data.mileage : null,
    model: normalizeCarModel(data.model),
    registrationNumber: normalizeRegistrationNumber(data.registrationNumber),
    technicalVisitExpiryDate: data.technicalVisitExpiryDate || null,
    year: Number.isFinite(data.year) ? data.year : null,
  };
}

function carToForm(car: Car): CreateCarDto {
  return {
    brand: car.brand,
    dailyPrice: car.dailyPrice,
    fuelType: car.fuelType,
    imageUrl: car.imageUrl ?? null,
    insuranceExpiryDate: car.insuranceExpiryDate?.slice(0, 10) ?? null,
    mileage: car.mileage,
    model: car.model,
    registrationNumber: car.registrationNumber,
    status: car.status,
    technicalVisitExpiryDate: car.technicalVisitExpiryDate?.slice(0, 10) ?? null,
    transmission: car.transmission,
    year: car.year,
  };
}

function CarIdentity({ car }: { car: Car }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <CarThumbnail car={car} />
      <div className="min-w-0">
        <p className="truncate font-semibold text-slate-800">{formatCarName(car.brand, car.model)}</p>
        <p className="mt-0.5 text-xs text-slate-500">{car.year ?? "-"}</p>
      </div>
    </div>
  );
}

function CarThumbnail({ car }: { car: Car }) {
  if (car.imageUrl) {
    return (
      <img
        alt={formatCarName(car.brand, car.model)}
        className="h-10 w-14 rounded-md object-cover"
        src={car.imageUrl}
      />
    );
  }

  return (
    <span className="flex h-10 w-14 items-center justify-center rounded-md bg-slate-100 text-slate-500 ring-1 ring-slate-200">
      <CarIcon className="h-6 w-6" />
    </span>
  );
}

function CarActions({
  car,
  hasOngoingReservation,
  onDelete,
  onEdit,
  onRetour,
  onView,
}: {
  car: Car;
  hasOngoingReservation: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onRetour: () => void;
  onView: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button aria-label="Voir" className="h-8 w-8 text-slate-500 hover:text-primary" onClick={onView} size="icon" title="Voir" variant="ghost">
        <Eye className="h-4 w-4" />
      </Button>
      <Button
        aria-label="Modifier"
        className="h-8 w-8 text-slate-500 hover:text-primary"
        onClick={onEdit}
        size="icon"
        title="Modifier"
        variant="ghost"
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        aria-label="Supprimer"
        className="h-8 w-8 text-slate-500 hover:text-destructive"
        onClick={onDelete}
        size="icon"
        title="Supprimer"
        variant="ghost"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      {car.status === "RENTED" && hasOngoingReservation ? (
        <Button
          aria-label="Retour voiture"
          className="h-8 rounded-full bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700"
          onClick={onRetour}
          size="sm"
          title="Enregistrer le retour"
          variant="ghost"
        >
          Retour
        </Button>
      ) : (
        <Button
          aria-label="Options"
          className="h-8 w-8 rounded-full border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-primary"
          size="icon"
          title="Options"
          variant="ghost"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function CarAlerts({ car }: { car: Car }) {
  const alerts = [
    getDateAlert(car.insuranceExpiryDate, "Assurance"),
    getDateAlert(car.technicalVisitExpiryDate, "Visite"),
  ].filter((alert): alert is DateAlert => Boolean(alert));

  if (!alerts.length) return <span className="text-muted-foreground">-</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {alerts.map((alert) => (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200"
          key={alert.label}
          title={alert.title}
        >
          <AlertTriangle className="h-3 w-3" />
          {alert.label}
        </span>
      ))}
    </div>
  );
}

function FleetStatusBadge({ status }: { status: CarStatus }) {
  const styles: Record<CarStatus, string> = {
    AVAILABLE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    MAINTENANCE: "bg-rose-50 text-rose-700 ring-rose-200",
    RENTED: "bg-blue-50 text-blue-700 ring-blue-200",
    UNAVAILABLE: "bg-slate-100 text-slate-600 ring-slate-200",
  };

  const dotStyles: Record<CarStatus, string> = {
    AVAILABLE: "bg-emerald-500",
    MAINTENANCE: "bg-rose-500",
    RENTED: "bg-blue-500",
    UNAVAILABLE: "bg-slate-500",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${styles[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotStyles[status]}`} />
      {getStatusLabel(status)}
    </span>
  );
}

function FleetStatCard({
  accent,
  detail,
  icon: Icon,
  label,
  value,
}: {
  accent: "amber" | "blue" | "emerald" | "rose";
  detail: string;
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  const styles = {
    amber: {
      icon: "bg-amber-50 text-amber-500 ring-amber-100",
      text: "text-slate-500",
    },
    blue: {
      icon: "bg-blue-50 text-blue-600 ring-blue-100",
      text: "text-emerald-600",
    },
    emerald: {
      icon: "bg-emerald-50 text-emerald-600 ring-emerald-100",
      text: "text-emerald-600",
    },
    rose: {
      icon: "bg-rose-50 text-rose-500 ring-rose-100",
      text: "text-slate-500",
    },
  }[accent];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <span className={`flex h-11 w-11 items-center justify-center rounded-full ring-1 ${styles.icon}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs font-semibold text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold leading-none text-slate-900">{value}</p>
          <p className={`mt-2 text-xs font-semibold ${styles.text}`}>{detail}</p>
        </div>
      </div>
    </div>
  );
}

function Pagination({
  currentPage,
  onPageChange,
  totalPages,
}: {
  currentPage: number;
  onPageChange: (page: number) => void;
  totalPages: number;
}) {
  const pages = buildPagination(currentPage, totalPages);

  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        aria-label="Page précédente"
        className="h-9 w-9 rounded-lg border-slate-200"
        disabled={currentPage === 1}
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        size="icon"
        variant="outline"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {pages.map((item, index) =>
        item === "ellipsis" ? (
          <span className="px-2 text-slate-400" key={`${item}-${index}`}>
            ...
          </span>
        ) : (
          <Button
            className={
              item === currentPage
                ? "h-9 w-9 rounded-lg border-blue-200 bg-white text-primary shadow-sm"
                : "h-9 w-9 rounded-lg border-slate-200 bg-white text-slate-600"
            }
            key={item}
            onClick={() => onPageChange(item)}
            size="icon"
            variant="outline"
          >
            {item}
          </Button>
        ),
      )}
      <Button
        aria-label="Page suivante"
        className="h-9 w-9 rounded-lg border-slate-200"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        size="icon"
        variant="outline"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function buildPagination(currentPage: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, "ellipsis", totalPages];
  }

  if (currentPage >= totalPages - 2) {
    return [1, "ellipsis", totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, "ellipsis", currentPage, "ellipsis", totalPages];
}

function getDateAlert(value: string | null | undefined, label: string) {
  if (!value) return null;
  const time = new Date(value).getTime();
  const now = Date.now();
  if (!Number.isFinite(time)) return null;
  if (time < now) return { label, title: `${label} expirée` };
  if (time <= now + 30 * 24 * 60 * 60 * 1000) return { label, title: `${label} expire bientôt` };
  return null;
}

type DateAlert = {
  label: string;
  title: string;
};

function formatMileage(value?: number | null) {
  if (!Number.isFinite(value)) return "-";
  return `${new Intl.NumberFormat("fr-TN", { maximumFractionDigits: 0 }).format(Number(value))} km`;
}

function isInCurrentMonth(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  return !Number.isNaN(date.getTime()) && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function getPercent(value: number, total: number) {
  return total ? Number(((value / total) * 100).toFixed(1)) : 0;
}

function getErrorMessage(caught: unknown) {
  return caught instanceof Error ? caught.message : String(caught);
}

function RegistrationNumber({ value }: { value: string }) {
  const normalized = normalizeRegistrationNumber(value);

  if (isValidRegistrationNumber(normalized)) return <span>{formatRegistrationNumber(normalized)}</span>;

  return (
    <span className="font-medium text-destructive" title={`Valeur actuelle : ${value}`}>
      Format invalide
    </span>
  );
}
