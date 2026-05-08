import type { Car } from "@/types/car";
import type { Client } from "@/types/client";
import type { Payment } from "@/types/payment";
import type { Reservation, ReservationStatus } from "@/types/reservation";
import { formatCarName, formatRegistrationNumber } from "@/utils/car";
import { normalizeClientName } from "@/utils/client";
import { getCalendarRentalDays, getLocalDateKey } from "@/utils/date";

export const RESERVATIONS_VIEW_MODE_STORAGE_KEY = "rentaldesk-reservations-view-mode";

export type ReservationViewMode = "calendar" | "list";
export type CalendarDisplayMode = "month" | "week";
export type ReservationFilterStatus = "ALL" | ReservationStatus;
export type ReservationPeriodFilter = "ALL" | "TODAY" | "WEEK" | "MONTH";

export interface ReservationFiltersState {
  query: string;
  status: ReservationFilterStatus;
  carId: number;
  period: ReservationPeriodFilter;
}

export interface ReservationViewModel {
  car?: Car;
  client?: Client;
  depositCollected: number;
  depositRefunded: number;
  durationDays: number;
  paid: number;
  remaining: number;
  reservation: Reservation;
  secondClient?: Client;
}

export const reservationStatuses: ReservationFilterStatus[] = [
  "ALL",
  "EN_ATTENTE",
  "ONGOING",
  "RESERVED",
  "COMPLETED",
  "CANCELLED",
];

export const reservationPeriodOptions: Array<{ label: string; value: ReservationPeriodFilter }> = [
  { label: "Toutes les périodes", value: "ALL" },
  { label: "Aujourd'hui", value: "TODAY" },
  { label: "Cette semaine", value: "WEEK" },
  { label: "Ce mois", value: "MONTH" },
];

export const statusColorClasses: Record<ReservationStatus, string> = {
  CANCELLED: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-900",
  COMPLETED: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
  EN_ATTENTE: "bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-950/40 dark:text-orange-200 dark:ring-orange-900",
  ONGOING: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:ring-blue-900",
  RESERVED: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900",
};

export const statusDotClasses: Record<ReservationStatus, string> = {
  CANCELLED: "bg-red-500",
  COMPLETED: "bg-slate-400",
  EN_ATTENTE: "bg-orange-500",
  ONGOING: "bg-blue-500",
  RESERVED: "bg-emerald-500",
};

export function buildReservationViewModels(
  reservations: Reservation[],
  clientsById: Map<number, Client>,
  carsById: Map<number, Car>,
  payments: Payment[],
) {
  return reservations.map((reservation): ReservationViewModel => {
    const paid = sumPayments(payments, reservation.id, "RENTAL_PAYMENT");
    const depositCollected = sumPayments(payments, reservation.id, "DEPOSIT");
    const depositRefunded = sumPayments(payments, reservation.id, "DEPOSIT_REFUND");

    return {
      car: carsById.get(reservation.carId) ?? reservation.car,
      client: clientsById.get(reservation.clientId) ?? reservation.client,
      depositCollected,
      depositRefunded,
      durationDays: getCalendarRentalDays(reservation.startDate, reservation.endDate),
      paid,
      remaining: Math.max(0, reservation.totalPrice - paid),
      reservation,
      secondClient: reservation.secondClientId
        ? clientsById.get(reservation.secondClientId) ?? reservation.secondClient ?? undefined
        : undefined,
    };
  });
}

export function filterReservationViewModels(items: ReservationViewModel[], filters: ReservationFiltersState) {
  const query = filters.query.trim().toLowerCase();
  const now = new Date();

  return items.filter((item) => {
    const { car, client, reservation, secondClient } = item;
    const matchesStatus = filters.status === "ALL" || reservation.status === filters.status;
    const matchesCar = filters.carId === 0 || reservation.carId === filters.carId;
    const matchesPeriod = filters.period === "ALL" || reservationMatchesPeriod(reservation, filters.period, now);

    const haystack = [
      client ? normalizeClientName(client.fullName) : "",
      client?.cin ?? "",
      client?.passportNumber ?? "",
      secondClient ? normalizeClientName(secondClient.fullName) : "",
      car ? formatCarName(car.brand, car.model) : "",
      car?.registrationNumber ?? "",
      car ? formatRegistrationNumber(car.registrationNumber) : "",
    ]
      .join(" ")
      .toLowerCase();

    const matchesQuery = !query || haystack.includes(query);
    return matchesStatus && matchesCar && matchesPeriod && matchesQuery;
  });
}

export function toCalendarReservations(items: ReservationViewModel[]) {
  return items.map(({ car, client, reservation, secondClient }) => ({
    ...reservation,
    car,
    client,
    secondClient,
  }));
}

export function getReservationStats(items: ReservationViewModel[]) {
  return {
    all: items.length,
    cancelled: items.filter((item) => item.reservation.status === "CANCELLED").length,
    completed: items.filter((item) => item.reservation.status === "COMPLETED").length,
    confirmed: items.filter((item) => item.reservation.status === "RESERVED").length,
    ongoing: items.filter((item) => item.reservation.status === "ONGOING").length,
    upcoming: items.filter((item) => item.reservation.status === "EN_ATTENTE").length,
  };
}

export function reservationTouchesDate(reservation: Reservation, dateKey: string) {
  const startKey = getLocalDateKey(reservation.startDate);
  const endKey = getLocalDateKey(reservation.endDate);
  return dateKey >= startKey && dateKey <= endKey;
}

export function getClientIdentity(client?: Client) {
  if (!client) return "CIN : -";
  if (client.cin) return `CIN : ${client.cin}`;
  if (client.passportNumber) return `Passeport : ${client.passportNumber}`;
  return "CIN : -";
}

export function getInitials(name?: string) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function sumPayments(payments: Payment[], reservationId: number, type: Payment["type"]) {
  return payments
    .filter((payment) => payment.reservationId === reservationId && payment.type === type)
    .reduce((sum, payment) => sum + payment.amount, 0);
}

function reservationMatchesPeriod(reservation: Reservation, period: ReservationPeriodFilter, now: Date) {
  const startKey = getLocalDateKey(reservation.startDate);
  const todayKey = getLocalDateKey(now);

  if (period === "TODAY") return reservationTouchesDate(reservation, todayKey);

  const start = new Date(reservation.startDate);
  if (!Number.isFinite(start.getTime())) return false;

  if (period === "WEEK") {
    const weekStart = new Date(now);
    const day = weekStart.getDay();
    weekStart.setDate(weekStart.getDate() - day + (day === 0 ? -6 : 1));
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    return start >= weekStart && start <= weekEnd;
  }

  if (period === "MONTH") {
    return startKey.slice(0, 7) === todayKey.slice(0, 7);
  }

  return true;
}
