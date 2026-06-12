import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { PageHeader } from "@/app/layout";
import { ArchiveConfirmDialog } from "@/components/archive/ArchiveConfirmDialog";
import { Breadcrumb, BreadcrumbItem, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ReservationCalendarView } from "@/pages/reservations/components/ReservationCalendarView";
import { ReservationListView } from "@/pages/reservations/components/ReservationListView";
import { ReservationQuickDetails } from "@/pages/reservations/components/ReservationQuickDetails";
import { ReservationViewToggle } from "@/pages/reservations/components/ReservationViewToggle";
import {
  RESERVATIONS_VIEW_MODE_STORAGE_KEY,
  buildReservationViewModels,
  filterReservationViewModels,
  getReservationStats,
  type CalendarDisplayMode,
  type ReservationFiltersState,
  type ReservationViewMode,
} from "@/pages/reservations/components/reservationViewUtils";
import { ReservationForm } from "@/pages/reservations/ReservationForm";
import { generateContract } from "@/services/contract.service";
import { archiveItem } from "@/services/archiveService";
import { getCars } from "@/services/car.service";
import { getClients } from "@/services/client.service";
import { getPayments } from "@/services/payment.service";
import {
  createReservation,
  deleteReservation,
  getReservations,
  updateReservation,
  updateReservationStatus,
} from "@/services/reservation.service";
import type { Car } from "@/types/car";
import type { Client } from "@/types/client";
import type { Payment } from "@/types/payment";
import type { CreateReservationDto, Reservation } from "@/types/reservation";
import { formatCarName } from "@/utils/car";
import { getLocalDateKey, getStartOfWeek } from "@/utils/date";
import { useNotifications } from "@/hooks/useNotifications";
import { useToast } from "@/hooks/useToast";

const initialFilters: ReservationFiltersState = {
  carId: 0,
  period: "ALL",
  query: "",
  status: "ALL",
};

export function ReservationsPage() {
  const [searchParams] = useSearchParams();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filters, setFilters] = useState<ReservationFiltersState>(() => ({
    ...initialFilters,
    carId: readCarIdSearchParam(searchParams),
  }));
  const [viewMode, setViewMode] = useState<ReservationViewMode>(() => readInitialViewMode(searchParams));
  const [calendarMode, setCalendarMode] = useState<CalendarDisplayMode>("month");
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateKey(new Date()));
  const [weekStartDate, setWeekStartDate] = useState(() => getStartOfWeek(new Date()));
  const [selectedReservationId, setSelectedReservationId] = useState<number | null>(null);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [archiveReservation, setArchiveReservation] = useState<Reservation | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { push } = useNotifications();
  const { showToast } = useToast();

  useEffect(() => {
    void reload();
  }, []);

  useEffect(() => {
    const requestedCarId = readCarIdSearchParam(searchParams);
    const requestedViewMode = readViewModeSearchParam(searchParams);

    if (searchParams.has("carId")) {
      setFilters({ ...initialFilters, carId: requestedCarId });
    }

    if (requestedViewMode) {
      setViewMode(requestedViewMode);
    }
  }, [searchParams]);

  useEffect(() => {
    window.localStorage.setItem(RESERVATIONS_VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  async function reload() {
    const [reservationsData, clientsData, carsData, paymentsData] = await Promise.all([
      getReservations(),
      getClients(),
      getCars(),
      getPayments(),
    ]);
    setReservations(reservationsData);
    setClients(clientsData);
    setCars(carsData);
    setPayments(paymentsData);
  }

  const clientsById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const carsById = useMemo(() => new Map(cars.map((car) => [car.id, car])), [cars]);

  const reservationItems = useMemo(
    () => buildReservationViewModels(reservations, clientsById, carsById, payments),
    [carsById, clientsById, payments, reservations],
  );
  const filteredItems = useMemo(() => filterReservationViewModels(reservationItems, filters), [filters, reservationItems]);
  const stats = useMemo(() => getReservationStats(reservationItems), [reservationItems]);
  const filteredCar = filters.carId ? carsById.get(filters.carId) : undefined;
  const selectedItem = selectedReservationId
    ? reservationItems.find((item) => item.reservation.id === selectedReservationId) ?? null
    : null;

  async function handleCreate(data: CreateReservationDto) {
    setError(null);
    try {
      const reservation = await createReservation(data);
      setReservations((current) => [reservation, ...current]);
      setCreateOpen(false);
      setSelectedDate(getLocalDateKey(reservation.startDate));
      await reload();
      showToast({ title: "Réservation créée", type: "success" });
    } catch (caught) {
      const message = getErrorMessage(caught);
      setError(message);
      showToast({ message, title: "Erreur réservation", type: "error" });
    }
  }

  async function handleUpdate(data: CreateReservationDto) {
    if (!editingReservation) return;
    setError(null);
    try {
      const reservation = await updateReservation(editingReservation.id, data);
      setReservations((current) => current.map((item) => (item.id === reservation.id ? reservation : item)));
      setEditingReservation(null);
      setSelectedReservationId(reservation.id);
      await reload();
      showToast({ title: "Réservation modifiée", type: "success" });
    } catch (caught) {
      const message = getErrorMessage(caught);
      setError(message);
      showToast({ message, title: "Modification impossible", type: "error" });
    }
  }

  async function handleStatus(
    id: number,
    status: Reservation["status"],
    details?: { returnMileage?: number | null; returnFuelLevel?: string | null },
  ) {
    try {
      const reservation = await updateReservationStatus(id, { status, ...details });

      if (status === "COMPLETED") {
        const { pickupMileage, returnMileage, carId } = reservation;
        if (
          returnMileage != null &&
          pickupMileage != null &&
          Math.floor(returnMileage / 10000) > Math.floor(pickupMileage / 10000)
        ) {
          const car = cars.find((item) => item.id === carId);
          const carName = car ? formatCarName(car.brand, car.model) : `Voiture #${carId}`;
          push({
            type: "mileage_threshold",
            message: `${carName} a dépassé ${Math.floor(returnMileage / 10000) * 10000} km. Vérifiez la révision.`,
            carId,
          });
        }
      }

      setReservations((current) => current.map((item) => (item.id === id ? reservation : item)));
      setSelectedReservationId(reservation.id);
      await reload();
      showToast({ title: getStatusToastTitle(status), type: "success" });
    } catch (caught) {
      showToast({ message: getErrorMessage(caught), title: "Erreur statut", type: "error" });
    }
  }

  async function handleGenerateContract(reservationId: number) {
    try {
      await generateContract(reservationId);
      showToast({ message: "Consultez la page Contrats.", title: "Contrat généré", type: "success" });
    } catch (caught) {
      showToast({ message: getErrorMessage(caught), title: "Erreur contrat", type: "error" });
    }
  }

  async function handleDeleteReservation(reservation: Reservation) {
    try {
      await deleteReservation(reservation.id);
      setSelectedReservationId(null);
      setReservations((current) => current.filter((item) => item.id !== reservation.id));
      await reload();
      showToast({ title: "Réservation supprimée", type: "success" });
    } catch (caught) {
      showToast({ message: getErrorMessage(caught), title: "Suppression impossible", type: "error" });
    }
  }

  async function handleArchiveReservation(reason?: string) {
    if (!archiveReservation) return;
    try {
      setArchiveLoading(true);
      await archiveItem({ id: archiveReservation.id, reason, type: "reservation" });
      setArchiveReservation(null);
      setSelectedReservationId(null);
      await reload();
      showToast({ title: "Réservation archivée avec succès", type: "success" });
    } catch (caught) {
      const message = getErrorMessage(caught);
      showToast({
        message,
        title: message.includes("active ou à venir") ? "Impossible d'archiver une réservation active ou à venir" : "Impossible d'archiver cet élément",
        type: "error",
      });
    } finally {
      setArchiveLoading(false);
    }
  }

  async function handleBulkArchiveReservations(selectedReservations: Reservation[]) {
    const archivable = selectedReservations.filter((reservation) => isArchivableReservationStatus(reservation.status));
    let archived = 0;

    for (const reservation of archivable) {
      try {
        await archiveItem({ id: reservation.id, type: "reservation" });
        archived += 1;
      } catch {
        // Count failed archive attempts as ignored in the user-facing summary.
      }
    }

    await reload();
    showToast({ message: `${archived} réservations archivées, ${selectedReservations.length - archived} ignorées`, title: "Archivage sélection", type: "success" });
  }

  const openCreateDialog = () => {
    setError(null);
    setCreateOpen(true);
  };

  const beginEdit = (reservation: Reservation) => {
    setEditingReservation(reservation);
    setSelectedReservationId(null);
    setError(null);
  };

  return (
    <div className="min-w-0 space-y-5 dark:bg-slate-950">
      {filteredCar && (
        <Breadcrumb>
          <BreadcrumbItem>
            <Link className="transition-smooth hover:text-primary" to="/cars">
              Véhicules
            </Link>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <Link className="truncate transition-smooth hover:text-primary" to={`/cars/${filteredCar.id}`}>
              {formatCarName(filteredCar.brand, filteredCar.model)}
            </Link>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem className="truncate text-foreground">Réservations</BreadcrumbItem>
        </Breadcrumb>
      )}

      <PageHeader title="Réservations">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <ReservationViewToggle mode={viewMode} onChange={setViewMode} />
          <Dialog
            onOpenChange={(value) => {
              setCreateOpen(value);
              if (!value) setError(null);
            }}
            open={createOpen}
          >
            <DialogTrigger asChild>
              <Button className="h-11 rounded-lg" onClick={openCreateDialog} type="button">
                <Plus className="h-4 w-4" />
                Nouvelle réservation
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[92vh] w-[min(96vw,980px)] overflow-y-auto p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle>Créer une réservation</DialogTitle>
              </DialogHeader>
              {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <ReservationForm cars={cars} clients={clients} onSubmit={handleCreate} reservations={reservations} />
            </DialogContent>
          </Dialog>
        </div>
      </PageHeader>

      {viewMode === "calendar" ? (
        <ReservationCalendarView
          calendarMode={calendarMode}
          cars={cars}
          carsById={carsById}
          clientsById={clientsById}
          filters={filters}
          items={filteredItems}
          monthDate={monthDate}
          onCalendarModeChange={setCalendarMode}
          onFiltersChange={setFilters}
          onMonthDateChange={setMonthDate}
          onSelectReservation={(reservation) => setSelectedReservationId(reservation.id)}
          onSelectedDateChange={setSelectedDate}
          onWeekStartDateChange={setWeekStartDate}
          selectedDate={selectedDate}
          weekStartDate={weekStartDate}
        />
      ) : (
        <ReservationListView
          cars={cars}
          filters={filters}
          items={filteredItems}
          onCreate={openCreateDialog}
          onArchive={setArchiveReservation}
          onArchiveSelected={handleBulkArchiveReservations}
          onEdit={beginEdit}
          onFiltersChange={setFilters}
          onSelect={(reservation) => setSelectedReservationId(reservation.id)}
          onStatusChange={handleStatus}
          stats={stats}
        />
      )}

      <ReservationQuickDetails
        hasActiveRentalForCar={
          selectedItem
            ? reservations.some(
                (reservation) =>
                  reservation.id !== selectedItem.reservation.id &&
                  reservation.carId === selectedItem.reservation.carId &&
                  reservation.status === "ONGOING",
              )
            : false
        }
        item={selectedItem}
        onClose={() => setSelectedReservationId(null)}
        onDelete={handleDeleteReservation}
        onEdit={beginEdit}
        onGenerateContract={handleGenerateContract}
        onStatusChange={handleStatus}
        open={Boolean(selectedItem)}
      />

      <Dialog
        onOpenChange={(value) => {
          if (!value) {
            setEditingReservation(null);
            setError(null);
          }
        }}
        open={Boolean(editingReservation)}
      >
        <DialogContent className="max-h-[92vh] w-[min(96vw,980px)] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Modifier la réservation</DialogTitle>
          </DialogHeader>
          {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {editingReservation && (
            <ReservationForm
              cars={cars}
              clients={clients}
              defaultValues={editingReservation}
              excludedReservationId={editingReservation.id}
              onSubmit={handleUpdate}
              reservations={reservations}
              submitLabel="Enregistrer la réservation"
            />
          )}
        </DialogContent>
      </Dialog>

      <ArchiveConfirmDialog
        itemTitle={archiveReservation ? `Réservation #${archiveReservation.id}` : "Réservation"}
        itemType="reservation"
        loading={archiveLoading}
        onCancel={() => !archiveLoading && setArchiveReservation(null)}
        onConfirm={(reason) => void handleArchiveReservation(reason)}
        open={Boolean(archiveReservation)}
      />
    </div>
  );
}

function isArchivableReservationStatus(status: Reservation["status"]) {
  return status === "COMPLETED" || status === "CANCELLED";
}

function readStoredViewMode(): ReservationViewMode {
  if (typeof window === "undefined") return "calendar";
  const stored = window.localStorage.getItem(RESERVATIONS_VIEW_MODE_STORAGE_KEY);
  return stored === "list" || stored === "calendar" ? stored : "calendar";
}

function readInitialViewMode(searchParams: URLSearchParams): ReservationViewMode {
  return readViewModeSearchParam(searchParams) ?? readStoredViewMode();
}

function readViewModeSearchParam(searchParams: URLSearchParams): ReservationViewMode | null {
  const view = searchParams.get("view");
  return view === "list" || view === "calendar" ? view : null;
}

function readCarIdSearchParam(searchParams: URLSearchParams) {
  const carId = Number(searchParams.get("carId"));
  return Number.isFinite(carId) && carId > 0 ? carId : 0;
}

function getStatusToastTitle(status: Reservation["status"]) {
  const labels: Record<Reservation["status"], string> = {
    CANCELLED: "Réservation annulée",
    COMPLETED: "Location terminée",
    EN_ATTENTE: "Réservation mise en attente",
    ONGOING: "Location démarrée",
    RESERVED: "Réservation confirmée",
  };

  return labels[status];
}

function getErrorMessage(caught: unknown) {
  return caught instanceof Error ? caught.message : String(caught);
}
