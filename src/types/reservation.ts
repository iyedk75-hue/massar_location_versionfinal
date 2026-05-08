import type { Car } from "@/types/car";
import type { Client } from "@/types/client";

export type ReservationStatus = "EN_ATTENTE" | "RESERVED" | "ONGOING" | "COMPLETED" | "CANCELLED";

export interface Reservation {
  id: number;
  clientId: number;
  secondClientId?: number | null;
  carId: number;
  startDate: string;
  endDate: string;
  dailyPrice: number;
  totalPrice: number;
  depositAmount: number;
  status: ReservationStatus;
  pickupMileage?: number | null;
  returnMileage?: number | null;
  pickupFuelLevel?: string | null;
  returnFuelLevel?: string | null;
  notes?: string | null;
  archived?: boolean | null;
  archivedAt?: string | null;
  archivedReason?: string | null;
  createdAt: string;
  updatedAt: string;
  client?: Client;
  secondClient?: Client | null;
  car?: Car;
}

export type CreateReservationDto = Omit<Reservation, "id" | "createdAt" | "updatedAt" | "client" | "secondClient" | "car">;
