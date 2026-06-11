import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Car as CarIcon,
  CheckCircle2,
  Eye,
  Fuel,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { getStatusLabel } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { DataGridActionMenu } from "@/components/ui/action-menu/DataGridActionMenu";
import { AppPagination } from "@/components/ui/pagination/AppPagination";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
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
import { formatMoney } from "@/utils/money";
import { useNotifications } from "@/hooks/useNotifications";
import { useConfirmAction } from "@/hooks/useConfirmAction";
import { useToast } from "@/hooks/useToast";
import { readStoredPageSize, writeStoredPageSize } from "@/lib/pagination";

const statuses: Array<"ALL" | CarStatus> = ["ALL", "AVAILABLE", "RENTED", "MAINTENANCE", "UNAVAILABLE"];
const fuelLevels = ["Plein", "3/4", "1/2", "1/4", "Vide"];
const carsPageSizeKey = "massar-pagination-page-size-cars";
const carStatusFilterOptions = statuses.map((item) => ({ value: item, label: item === "ALL" ? "Tous les statuts" : getStatusLabel(item) }));
const fuelLevelOptions = fuelLevels.map((level) => ({ value: level, label: level }));

export function CarsPage() {
  const navigate = useNavigate();
  const [cars, setCars] = useState<Car[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | CarStatus>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => readStoredPageSize(carsPageSizeKey));
  const [open, setOpen] = useState(false);
  const [editingCar, setEditingCar] = useState<Car | null>(null);
  const [retourCar, setRetourCar] = useState<Car | null>(null);
  const [retourMileage, setRetourMileage] = useState<string>("");
  const [retourFuel, setRetourFuel] = useState<string>("Plein");
  const [selectedCarIds, setSelectedCarIds] = useState<number[]>([]);
  const [bulkActionsOpen, setBulkActionsOpen] = useState(false);
  const { push } = useNotifications();
  const { confirmAction } = useConfirmAction();
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

  function handlePageSizeChange(nextPageSize: number) {
    setPageSize(nextPageSize);
    writeStoredPageSize(carsPageSizeKey, nextPageSize);
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

  function handleDelete(id: number) {
    confirmAction({
      action: "supprimer",
      confirmLabel: "Supprimer",
      description: "Cette voiture sera supprimée de la flotte.",
      title: "Supprimer cette voiture ?",
      onConfirm: async () => {
        try {
          await deleteCar(id);
          setCars((current) => current.filter((car) => car.id !== id));
          showToast({ title: "Voiture supprimée", type: "success" });
        } catch (caught) {
          showToast({ message: getErrorMessage(caught), title: "Suppression impossible", type: "error" });
        }
      },
    });
  }

  function handleSelectedCarsDelete() {
    if (!selectedCars.length) {
      showToast({ message: "Cochez au moins une voiture dans la liste.", title: "Aucune sélection", type: "info" });
      setBulkActionsOpen(false);
      return;
    }

    confirmAction({
      action: "supprimer",
      confirmLabel: "Supprimer",
      description: `${selectedCars.length} voiture${selectedCars.length > 1 ? "s" : ""} seront supprimées de la flotte.`,
      title: "Supprimer la sélection ?",
      onConfirm: async () => {
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
      },
    });
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
          <SearchableSelect
            ariaLabel="Filtrer les voitures par statut"
            className="h-11 rounded-lg border-slate-200 text-slate-600"
            onValueChange={(nextValue) => setStatus(nextValue as "ALL" | CarStatus)}
            options={carStatusFilterOptions}
            value={status}
          />
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
                  onClick={handleSelectedCarsDelete}
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
          <div className="w-full overflow-x-auto md:overflow-x-visible">
            <table className="w-full min-w-[760px] table-fixed text-left text-sm md:min-w-0">
              <thead className="bg-slate-100/80 text-xs uppercase text-slate-500">
                <tr>
                  <th className="w-10 px-3 py-4">
                    <input
                      aria-label="Sélectionner les voitures visibles"
                      checked={allVisibleCarsSelected}
                      className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                      disabled={!visibleCarIds.length}
                      onChange={toggleVisibleCars}
                      type="checkbox"
                    />
                  </th>
                  <th className="w-[108px] px-2 py-4 font-semibold lg:w-[126px]">Immat.</th>
                  <th className="min-w-0 px-2 py-4 font-semibold">Voiture</th>
                  <th className="w-[76px] px-2 py-4 font-semibold lg:w-[88px]">Carb.</th>
                  <th className="w-[86px] px-2 py-4 font-semibold lg:w-[100px]">Prix</th>
                  <th className="w-[92px] px-2 py-4 font-semibold lg:w-[110px]">Km</th>
                  <th className="w-[104px] px-2 py-4 font-semibold lg:w-[124px]">Alertes</th>
                  <th className="w-[112px] px-2 py-4 font-semibold lg:w-[126px]">Statut</th>
                  <th className="w-[136px] px-3 py-4 text-right font-semibold lg:w-[150px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedCars.length ? (
                  paginatedCars.map((car) => (
                    <tr
                      className={`cursor-pointer transition-colors ${
                        selectedCarIdsSet.has(car.id) ? "bg-blue-50/70 hover:bg-blue-50" : "hover:bg-slate-50/80"
                      }`}
                      key={car.id}
                      onClick={() => navigate(`/cars/${car.id}`)}
                    >
                      <td className="w-10 px-3 py-4" onClick={(event) => event.stopPropagation()}>
                        <input
                          aria-label={`Sélectionner ${formatCarName(car.brand, car.model)}`}
                          checked={selectedCarIdsSet.has(car.id)}
                          className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                          onChange={() => toggleCarSelection(car.id)}
                          type="checkbox"
                        />
                      </td>
                      <td className="overflow-hidden whitespace-nowrap px-2 py-4 font-semibold text-slate-700">
                        <RegistrationNumber value={car.registrationNumber} />
                      </td>
                      <td className="min-w-0 overflow-hidden px-2 py-4">
                        <CarIdentity car={car} />
                      </td>
                      <td className="overflow-hidden whitespace-nowrap px-2 py-4 font-medium text-slate-700">{car.fuelType}</td>
                      <td className="overflow-hidden whitespace-nowrap px-2 py-4 font-semibold text-slate-700">{formatMoney(car.dailyPrice)}</td>
                      <td className="overflow-hidden whitespace-nowrap px-2 py-4 text-slate-600">{formatMileage(car.mileage)}</td>
                      <td className="overflow-hidden px-2 py-4">
                        <CarAlerts car={car} />
                      </td>
                      <td className="overflow-hidden px-2 py-4">
                        <FleetStatusBadge status={car.status} />
                      </td>
                      <td className="px-3 py-4" onClick={(event) => event.stopPropagation()}>
                        <CarActions
                          car={car}
                          hasOngoingReservation={ongoingByCarId.has(car.id)}
                          onDelete={() => handleDelete(car.id)}
                          onEdit={() => {
                            setEditingCar(car);
                            setOpen(true);
                          }}
                          onRetour={() => {
                            setRetourCar(car);
                            setRetourMileage("");
                            setRetourFuel("Plein");
                          }}
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

        {selectedCarIds.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {selectedCarIds.length} sélectionnée{selectedCarIds.length > 1 ? "s" : ""}
          </p>
        )}
        <AppPagination
          currentPage={safePage}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
          pageSize={pageSize}
          totalItems={filteredCars.length}
          totalPages={totalPages}
        />
      </div>

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
                <SearchableSelect
                  ariaLabel="Sélectionner le niveau carburant au retour"
                  onValueChange={setRetourFuel}
                  options={fuelLevelOptions}
                  searchPlaceholder="Rechercher un niveau..."
                  value={retourFuel}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button onClick={() => setRetourCar(null)} type="button" variant="outline">
                  Annuler
                </Button>
                <Button
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() =>
                    confirmAction({
                      action: "retour",
                      confirmLabel: "Confirmer retour",
                      description: "Cette action terminera la location avec les informations de retour saisies.",
                      title: "Enregistrer le retour ?",
                      onConfirm: handleRetour,
                    })
                  }
                  type="button"
                >
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
    <div className="flex min-w-0 items-center gap-2 lg:gap-3">
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
        className="h-9 w-12 shrink-0 rounded-md object-cover lg:h-10 lg:w-14"
        src={car.imageUrl}
      />
    );
  }

  return (
    <span className="flex h-9 w-12 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 ring-1 ring-slate-200 lg:h-10 lg:w-14">
      <CarIcon className="h-5 w-5 lg:h-6 lg:w-6" />
    </span>
  );
}

function CarActions({
  car,
  hasOngoingReservation,
  onDelete,
  onEdit,
  onRetour,
}: {
  car: Car;
  hasOngoingReservation: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onRetour: () => void;
}) {
  return (
    <div className="flex justify-end">
      <DataGridActionMenu
        actions={[
          { href: `/cars/${car.id}`, icon: Eye, label: "Voir détails" },
          { icon: Pencil, label: "Modifier", onClick: onEdit },
          ...(car.status === "RENTED" && hasOngoingReservation
            ? [{ icon: CheckCircle2, label: "Enregistrer le retour", onClick: onRetour }]
            : []),
          { destructive: true, icon: Trash2, label: "Supprimer", onClick: onDelete },
        ]}
      />
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
    <div className="flex min-w-0 flex-wrap gap-1">
      {alerts.map((alert) => (
        <span
          className="inline-flex max-w-full items-center gap-1 rounded-full bg-amber-50 px-1.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200 lg:px-2"
          key={alert.label}
          title={alert.title}
        >
          <AlertTriangle className="h-3 w-3 shrink-0" />
          <span className="truncate">{alert.label}</span>
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
    <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold ring-1 ${styles[status]}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotStyles[status]}`} />
      <span className="truncate">{getStatusLabel(status)}</span>
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

  if (isValidRegistrationNumber(normalized)) return <span className="block truncate">{formatRegistrationNumber(normalized)}</span>;

  return (
    <span className="block truncate font-medium text-destructive" title={`Valeur actuelle : ${value}`}>
      Format invalide
    </span>
  );
}
