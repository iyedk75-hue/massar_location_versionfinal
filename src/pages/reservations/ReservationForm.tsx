import { useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import type { Car } from "@/types/car";
import type { Client } from "@/types/client";
import type { CreateReservationDto, Reservation } from "@/types/reservation";
import { formatCarName, formatRegistrationNumber } from "@/utils/car";
import { formatClientIdentity, normalizeClientName } from "@/utils/client";
import { combineDateAndTime, formatDateTime, formatRentalDuration, getLocalDateKey, getRentalDays } from "@/utils/date";
import { formatMoney } from "@/utils/money";

type ReservationFormProps = {
  onSubmit: (data: CreateReservationDto) => void | Promise<void>;
  cars: Car[];
  clients: Client[];
  reservations: Reservation[];
  defaultValues?: Partial<Reservation>;
  excludedReservationId?: number;
  submitLabel?: string;
};

type ReservationFormValues = CreateReservationDto & {
  pickupTime: string;
  returnTime: string;
};

type CarAvailability = {
  available: boolean;
  bookedOnPeriod: boolean;
  technicalVisitExpired: boolean;
  unavailableStatus: boolean;
};

const blockingReservationStatuses: Reservation["status"][] = ["EN_ATTENTE", "RESERVED", "ONGOING", "COMPLETED"];

export function ReservationForm({
  onSubmit,
  cars,
  clients,
  reservations,
  defaultValues,
  excludedReservationId,
  submitLabel,
}: ReservationFormProps) {
  const today = getLocalDateKey(new Date());
  const initialStart = defaultValues?.startDate ? new Date(defaultValues.startDate) : null;
  const initialEnd = defaultValues?.endDate ? new Date(defaultValues.endDate) : null;
  const initialCarIdRef = useRef(defaultValues?.carId ?? 0);
  const didInitializeCarPricingRef = useRef(false);
  const isEditing = Boolean(defaultValues?.id);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { dirtyFields, errors },
  } = useForm<ReservationFormValues>({
    defaultValues: {
      clientId: 0,
      secondClientId: null,
      carId: 0,
      startDate: initialStart ? getLocalDateKey(initialStart) : today,
      endDate: initialEnd ? getLocalDateKey(initialEnd) : addDaysKey(today, 1),
      pickupTime: initialStart ? formatTimeInput(initialStart) : "09:00",
      returnTime: initialEnd ? formatTimeInput(initialEnd) : "09:00",
      dailyPrice: defaultValues?.dailyPrice ?? 0,
      totalPrice: defaultValues?.totalPrice ?? 0,
      depositAmount: defaultValues?.depositAmount ?? 0,
      status: defaultValues?.status ?? "EN_ATTENTE",
      ...withoutDateTimeDefaults(defaultValues),
    },
  });

  const clientId = Number(watch("clientId"));
  const secondClientId = Number(watch("secondClientId") ?? 0);
  const carId = Number(watch("carId"));
  const startDate = watch("startDate");
  const endDate = watch("endDate");
  const pickupTime = watch("pickupTime");
  const returnTime = watch("returnTime");
  const dailyPrice = Number(watch("dailyPrice"));
  const depositAmount = Number(watch("depositAmount"));
  const startDateTime = combineDateAndTime(startDate, pickupTime);
  const endDateTime = combineDateAndTime(endDate, returnTime);

  const selectedClient = useMemo(() => clients.find((client) => client.id === clientId), [clientId, clients]);
  const selectedCar = useMemo(() => cars.find((car) => car.id === carId), [carId, cars]);
  const defaultClientId = Number(defaultValues?.clientId ?? 0);
  const defaultSecondClientId = Number(defaultValues?.secondClientId ?? 0);
  const dateRangeIsValid = Boolean(startDateTime && endDateTime && new Date(endDateTime).getTime() > new Date(startDateTime).getTime());
  const rentalDays = dateRangeIsValid ? getRentalDays(startDateTime, endDateTime) : 0;
  const totalPrice = rentalDays * dailyPrice;
  const selectableClients = useMemo(
    () =>
      clients.filter(
        (client) => isClientActive(client) || client.id === defaultClientId || client.id === defaultSecondClientId,
      ),
    [clients, defaultClientId, defaultSecondClientId],
  );

  const availabilityByCar = useMemo(() => {
    return new Map(cars.map((car) => [car.id, getCarAvailability(car, startDateTime, endDateTime, reservations, excludedReservationId)]));
  }, [cars, endDateTime, excludedReservationId, reservations, startDateTime]);

  const sortedCars = useMemo(
    () =>
      [...cars].sort((first, second) => {
        const firstAvailable = availabilityByCar.get(first.id)?.available ?? false;
        const secondAvailable = availabilityByCar.get(second.id)?.available ?? false;

        if (firstAvailable !== secondAvailable) return firstAvailable ? -1 : 1;
        return formatCarName(first.brand, first.model).localeCompare(formatCarName(second.brand, second.model));
      }),
    [availabilityByCar, cars],
  );

  const clientOptions = useMemo(
    () => [
      { value: 0, label: "Sélectionner" },
      ...selectableClients.map((client) => ({
        description: formatClientIdentity(client),
        disabled: !isClientActive(client) && client.id !== defaultClientId,
        keywords: `${client.phone ?? ""} ${client.cin ?? ""} ${client.passportNumber ?? ""}`,
        label: `${normalizeClientName(client.fullName)}${!isClientActive(client) ? " (désactivé)" : ""}`,
        value: client.id,
      })),
    ],
    [defaultClientId, selectableClients],
  );
  const secondClientOptions = useMemo(
    () => [
      { value: 0, label: "Aucun" },
      ...selectableClients.map((client) => ({
        description: formatClientIdentity(client),
        disabled: client.id === clientId || (!isClientActive(client) && client.id !== defaultSecondClientId),
        keywords: `${client.phone ?? ""} ${client.cin ?? ""} ${client.passportNumber ?? ""}`,
        label: `${normalizeClientName(client.fullName)}${!isClientActive(client) ? " (désactivé)" : ""}`,
        value: client.id,
      })),
    ],
    [clientId, defaultSecondClientId, selectableClients],
  );
  const carOptions = useMemo(
    () => [
      { value: 0, label: "Sélectionner" },
      ...sortedCars.map((car) => {
        const availability = availabilityByCar.get(car.id);
        const available = availability?.available ?? false;
        const registrationNumber = formatRegistrationNumber(car.registrationNumber);

        return {
          disabled: !available,
          keywords: `${car.brand} ${car.model} ${car.registrationNumber} ${registrationNumber}`,
          label: `${formatCarName(car.brand, car.model)} - ${registrationNumber} (${available ? "Disponible" : "Non disponible"})`,
          value: car.id,
        };
      }),
    ],
    [availabilityByCar, sortedCars],
  );

  const selectedCarAvailability = selectedCar ? availabilityByCar.get(selectedCar.id) : undefined;

  useEffect(() => {
    if (!selectedCar) {
      setValue("dailyPrice", 0, { shouldValidate: true });
      setValue("depositAmount", 0, { shouldValidate: true });
      return;
    }

    if (!didInitializeCarPricingRef.current) {
      didInitializeCarPricingRef.current = true;
      if (defaultValues?.id && selectedCar.id === initialCarIdRef.current) return;
    }

    setValue("dailyPrice", selectedCar.dailyPrice, { shouldValidate: true });
    setValue("depositAmount", getSuggestedDeposit(selectedCar.dailyPrice), { shouldValidate: true });
  }, [defaultValues?.id, selectedCar, setValue]);

  useEffect(() => {
    setValue("totalPrice", totalPrice, { shouldValidate: true });
  }, [setValue, totalPrice]);

  useEffect(() => {
    const keepInitialEditingDates = isEditing && !dirtyFields.startDate && !dirtyFields.endDate && endDate;
    if (keepInitialEditingDates) return;

    if (startDate && !dirtyFields.endDate) {
      setValue("endDate", addDaysKey(startDate, 1), { shouldValidate: true });
    } else if (startDate && endDate && getMinimumEndDateTime(startDate, pickupTime) > new Date(endDateTime).getTime()) {
      setValue("endDate", addDaysKey(startDate, 1), { shouldDirty: true, shouldValidate: true });
    }
  }, [dirtyFields.endDate, dirtyFields.startDate, endDate, endDateTime, isEditing, pickupTime, setValue, startDate]);

  useEffect(() => {
    if (!pickupTime) return;
    const keepInitialEditingTimes = isEditing && !dirtyFields.pickupTime && !dirtyFields.returnTime && returnTime;
    if (keepInitialEditingTimes) return;

    if (!dirtyFields.returnTime) {
      setValue("returnTime", pickupTime, { shouldValidate: true });
    } else if (getMinimumEndDateTime(startDate, pickupTime) > new Date(endDateTime).getTime()) {
      setValue("returnTime", pickupTime, { shouldValidate: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirtyFields.pickupTime, dirtyFields.returnTime, endDate, endDateTime, isEditing, pickupTime, returnTime, setValue, startDate]);

  useEffect(() => {
    if (carId > 0 && dateRangeIsValid) void trigger("carId");
  }, [carId, dateRangeIsValid, trigger]);

  function submitForm(data: ReservationFormValues) {
    const { pickupTime: _pickupTime, returnTime: _returnTime, ...reservation } = data;

    return onSubmit({
      ...reservation,
      carId: Number(data.carId),
      clientId: Number(data.clientId),
      secondClientId: Number(data.secondClientId) > 0 ? Number(data.secondClientId) : null,
      startDate: startDateTime,
      endDate: endDateTime,
      dailyPrice: Number(data.dailyPrice),
      depositAmount: Number(data.depositAmount),
      totalPrice,
    });
  }

  function setToday() {
    const value = getLocalDateKey(new Date());
    setValue("startDate", value, { shouldDirty: true, shouldValidate: true });
    setValue("endDate", addDaysKey(value, 1), { shouldDirty: true, shouldValidate: true });
  }

  return (
    <form className="grid gap-4 lg:grid-cols-2" onSubmit={handleSubmit(submitForm)}>
      <div>
        <Label>Client</Label>
        <input
          type="hidden"
          {...register("clientId", {
            valueAsNumber: true,
            validate: (value) => validateClientSelection(Number(value), clients, defaultClientId),
          })}
        />
        <SearchableSelect
          ariaLabel="S?lectionner le client"
          onValueChange={(nextValue) => {
            setValue("clientId", Number(nextValue), { shouldDirty: true, shouldValidate: true });
            void trigger("clientId");
          }}
          options={clientOptions}
          searchPlaceholder="Rechercher un client..."
          value={clientId}
        />
        {errors.clientId && <p className="mt-1 text-xs text-destructive">{errors.clientId.message}</p>}
      </div>

      <div>
        <Label>Deuxième conducteur</Label>
        <input
          type="hidden"
          {...register("secondClientId", {
            valueAsNumber: true,
            validate: (value) => {
              if (!value) return true;
              if (Number(value) === clientId) return "Le deuxième conducteur doit être différent du client principal.";
              return validateClientSelection(Number(value), clients, defaultSecondClientId);
            },
          })}
        />
        <SearchableSelect
          ariaLabel="Sélectionner le deuxième conducteur"
          onValueChange={(nextValue) => {
            setValue("secondClientId", Number(nextValue), { shouldDirty: true, shouldValidate: true });
            void trigger("secondClientId");
          }}
          options={secondClientOptions}
          searchPlaceholder="Rechercher un conducteur..."
          value={secondClientId}
        />
        {errors.secondClientId && <p className="mt-1 text-xs text-destructive">{errors.secondClientId.message}</p>}
      </div>

      <div>
        <Label>Voiture disponible</Label>
        <input
          type="hidden"
          {...register("carId", {
            valueAsNumber: true,
            validate: (value) => validateCarSelection(Number(value), availabilityByCar),
          })}
        />
        <SearchableSelect
          ariaLabel="S?lectionner une voiture disponible"
          onValueChange={(nextValue) => {
            setValue("carId", Number(nextValue), { shouldDirty: true, shouldValidate: true });
            void trigger("carId");
          }}
          options={carOptions}
          searchPlaceholder="Rechercher une voiture..."
          value={carId}
        />
        {selectedCarAvailability?.bookedOnPeriod && (
          <Alert className="mt-2" variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>Voiture indisponible</AlertTitle>
            <AlertDescription>
              Cette voiture est déjà réservée sur cette période.
              Veuillez sélectionner une autre voiture ou modifier les dates.
            </AlertDescription>
          </Alert>
        )}
        {selectedCarAvailability?.technicalVisitExpired && (
          <p className="mt-1 text-xs text-destructive">La visite technique est expir?e pour cette p?riode.</p>
        )}
        {selectedCarAvailability?.unavailableStatus && (
          <p className="mt-1 text-xs text-destructive">Cette voiture est en maintenance ou indisponible.</p>
        )}
        {errors.carId && !selectedCarAvailability?.bookedOnPeriod && (
          <p className="mt-1 text-xs text-destructive">{errors.carId.message}</p>
        )}
      </div>

      <div className="grid gap-3 lg:col-span-2 sm:grid-cols-2 xl:grid-cols-4">
        <div className="min-w-0">
          <div className="mb-1 flex items-center justify-between gap-3">
            <Label>Date début</Label>
          </div>
          <Input
            type="date"
            {...register("startDate", {
              required: "Sélectionnez une date de début.",
            })}
          />
          <Button className="mt-2" onClick={setToday} size="sm" type="button" variant="outline">
            Aujourd'hui
          </Button>
          {errors.startDate && <p className="mt-1 text-xs text-destructive">{errors.startDate.message}</p>}
        </div>
        <div className="min-w-0">
          <Label className="mb-1 block">Heure de prise</Label>
          <Input
            type="time"
            {...register("pickupTime", {
              required: "Sélectionnez une heure de prise.",
            })}
          />
          {errors.pickupTime && <p className="mt-1 text-xs text-destructive">{errors.pickupTime.message}</p>}
        </div>
        <div className="min-w-0">
          <Label className="mb-1 block">Date fin</Label>
          <Input
            min={addDaysKey(startDate, 1)}
            type="date"
            {...register("endDate", {
              required: "Sélectionnez une date de fin.",
              validate: () => validateEndDateTime(startDateTime, endDateTime),
            })}
          />
          {errors.endDate && <p className="mt-1 text-xs text-destructive">{errors.endDate.message}</p>}
        </div>
        <div className="min-w-0">
          <Label className="mb-1 block">Heure de retour</Label>
          <Input
            type="time"
            {...register("returnTime", {
              required: "Sélectionnez une heure de retour.",
              validate: () => validateEndDateTime(startDateTime, endDateTime),
            })}
          />
          {errors.returnTime && <p className="mt-1 text-xs text-destructive">{errors.returnTime.message}</p>}
        </div>
      </div>

      <p className="lg:col-span-2 text-xs text-muted-foreground -mt-2">
        Durée minimale : 24h. La date fin est proposée automatiquement à Date début + 1 jour.
      </p>

      <div>
        <Label>Prix/jour</Label>
        <Input
          min="0.001"
          step="0.001"
          type="number"
          {...register("dailyPrice", {
            valueAsNumber: true,
            validate: (value) => Number(value) > 0 || "Le prix/jour doit être supérieur à 0.",
          })}
        />
        <p className="mt-1 text-xs text-muted-foreground">Prix proposé automatiquement, modifiable.</p>
        {errors.dailyPrice && <p className="mt-1 text-xs text-destructive">{errors.dailyPrice.message}</p>}
      </div>

      <div>
        <Label>Caution</Label>
        <Input
          min="0"
          step="0.001"
          type="number"
          {...register("depositAmount", {
            valueAsNumber: true,
            validate: (value) => Number(value) >= 0 || "La caution doit être supérieure ou égale à 0.",
          })}
        />
        {selectedCar && <p className="mt-1 text-xs text-muted-foreground">Caution suggérée automatiquement.</p>}
        {errors.depositAmount && <p className="mt-1 text-xs text-destructive">{errors.depositAmount.message}</p>}
      </div>

      <div className="lg:col-span-2 rounded-md border border-border bg-white p-4 text-sm">
        <h3 className="mb-3 font-semibold">Détail du prix</h3>
        <dl className="grid gap-2">
          <SummaryRow label="Prix/jour" value={formatMoney(dailyPrice)} />
          <SummaryRow label="Date et heure de prise" value={formatDateTime(startDateTime)} />
          <SummaryRow label="Date et heure de retour" value={formatDateTime(endDateTime)} />
          <SummaryRow label="Durée calculée" value={dateRangeIsValid ? formatRentalDuration(startDateTime, endDateTime) : "-"} />
          <SummaryRow label="Nombre de jours facturés" value={`${rentalDays} ${rentalDays > 1 ? "jours" : "jour"}`} />
          <SummaryRow emphasized label="Total location" value={formatMoney(totalPrice)} />
          <SummaryRow label="Caution" value={formatMoney(depositAmount)} />
        </dl>
      </div>

      <div className="lg:col-span-2 rounded-md border border-border bg-muted/60 p-4 text-sm">
        <h3 className="mb-3 font-semibold">Résumé</h3>
        <dl className="grid gap-2">
          <SummaryRow label="Client" value={selectedClient ? normalizeClientName(selectedClient.fullName) : "-"} />
          <SummaryRow label="Deuxième conducteur" value={secondClientId > 0 ? normalizeClientName(clients.find((client) => client.id === secondClientId)?.fullName) : "-"} />
          <SummaryRow label="Voiture" value={selectedCar ? formatCarName(selectedCar.brand, selectedCar.model) : "-"} />
          <SummaryRow label="Prise" value={formatSummaryDateTime(startDateTime)} />
          <SummaryRow label="Retour" value={formatSummaryDateTime(endDateTime)} />
          <SummaryRow label="Durée" value={dateRangeIsValid ? formatRentalDuration(startDateTime, endDateTime) : "-"} />
          <SummaryRow label="Jours facturés" value={`${rentalDays} ${rentalDays > 1 ? "jours" : "jour"}`} />
          <SummaryRow label="Total" value={formatMoney(totalPrice)} />
          <SummaryRow label="Caution" value={formatMoney(depositAmount)} />
        </dl>
      </div>

      <div className="lg:col-span-2 flex justify-end">
        <Button type="submit">{submitLabel ?? "Créer réservation"}</Button>
      </div>
    </form>
  );
}

function validateEndDateTime(startDateTime: string, endDateTime: string) {
  if (!startDateTime || !endDateTime) return "La période est incomplète.";
  const diff = new Date(endDateTime).getTime() - new Date(startDateTime).getTime();
  return diff >= 24 * 60 * 60 * 1000 || "La durée minimale de location est de 24h.";
}

function validateCarSelection(carId: number, availabilityByCar: Map<number, CarAvailability>) {
  if (carId <= 0) return "Sélectionnez une voiture.";

  const availability = availabilityByCar.get(carId);
  if (availability?.unavailableStatus) return "Cette voiture est en maintenance ou indisponible.";
  if (availability?.technicalVisitExpired) return "La visite technique est expirée pour cette période.";
  if (availability?.bookedOnPeriod) return "Cette voiture est déjà réservée sur cette période.";
  if (!availability?.available) return "Cette voiture n'est pas disponible sur cette période.";

  return true;
}

function getCarAvailability(
  car: Car,
  startDateTime: string,
  endDateTime: string,
  reservations: Reservation[],
  excludedReservationId?: number,
): CarAvailability {
  const technicalVisitExpired = isTechnicalVisitExpiredForPeriod(car.technicalVisitExpiryDate, endDateTime || startDateTime);
  const dateRangeIsValid = Boolean(startDateTime && endDateTime && new Date(endDateTime).getTime() > new Date(startDateTime).getTime());
  const bookedOnPeriod =
    dateRangeIsValid &&
    reservations.some(
      (reservation) =>
        reservation.carId === car.id &&
        reservation.id !== excludedReservationId &&
        blockingReservationStatuses.includes(reservation.status) &&
        rangesOverlap(startDateTime, endDateTime, reservation.startDate, reservation.endDate),
    );
  const unavailableStatus = ["MAINTENANCE", "UNAVAILABLE"].includes(car.status);

  return {
    available: !unavailableStatus && !bookedOnPeriod && !technicalVisitExpired,
    bookedOnPeriod,
    technicalVisitExpired,
    unavailableStatus,
  };
}

function isTechnicalVisitExpiredForPeriod(technicalVisitExpiryDate?: string | null, periodEndDate?: string | null) {
  if (!technicalVisitExpiryDate || !periodEndDate) return false;

  return getLocalDateKey(technicalVisitExpiryDate) < getLocalDateKey(periodEndDate);
}

function rangesOverlap(startDate: string, endDate: string, existingStartDate: string, existingEndDate: string) {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const existingStart = new Date(normalizeLegacyDateTime(existingStartDate, "start")).getTime();
  const existingEnd = new Date(normalizeLegacyDateTime(existingEndDate, "end")).getTime();

  return existingStart < end && existingEnd >= start;
}

function normalizeLegacyDateTime(value: string, boundary: "start" | "end") {
  if (value.length > 10) return value;
  return boundary === "start" ? `${value}T00:00:00.000` : `${value}T23:59:59.999`;
}

function getSuggestedDeposit(dailyPrice: number) {
  return Math.max(1000, Math.ceil((dailyPrice * 8) / 100) * 100);
}

function addDaysKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  return getLocalDateKey(date);
}

function validateClientSelection(clientId: number, clients: Client[], allowedInactiveClientId = 0) {
  if (clientId <= 0) return "Sélectionnez un client.";

  const client = clients.find((item) => item.id === clientId);
  if (!client) return "Client introuvable.";
  if (!isClientActive(client) && client.id !== allowedInactiveClientId) return "Ce client est désactivé.";

  return true;
}

function isClientActive(client: Client) {
  return client.isActive !== false;
}

function getMinimumEndDateTime(startDate: string, pickupTime: string) {
  return new Date(combineDateAndTime(startDate, pickupTime)).getTime() + 24 * 60 * 60 * 1000;
}

function formatTimeInput(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function withoutDateTimeDefaults(defaultValues?: Partial<Reservation>): Partial<ReservationFormValues> {
  if (!defaultValues) return {};
  const { startDate: _startDate, endDate: _endDate, client: _client, secondClient: _secondClient, car: _car, ...rest } = defaultValues;
  return rest;
}

function formatSummaryDateTime(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";

  const day = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
  const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(date);

  return `${day} à ${time}`;
}

function SummaryRow({ emphasized, label, value }: { emphasized?: boolean; label: string; value: string }) {
  return (
    <div
      className={`grid gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-4 ${
        emphasized ? "border-t border-border pt-2 font-semibold" : ""
      }`}
    >
      <dt className="min-w-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-left sm:text-right">{value}</dd>
    </div>
  );
}
