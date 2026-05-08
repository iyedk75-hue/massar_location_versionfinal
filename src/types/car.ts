export type CarStatus = "AVAILABLE" | "RENTED" | "MAINTENANCE" | "UNAVAILABLE";

export interface Car {
  id: number;
  brand: string;
  model: string;
  registrationNumber: string;
  year?: number | null;
  fuelType: string;
  transmission: string;
  dailyPrice: number;
  status: CarStatus;
  mileage?: number | null;
  imageUrl?: string | null;
  insuranceExpiryDate?: string | null;
  technicalVisitExpiryDate?: string | null;
  archived?: boolean | null;
  archivedAt?: string | null;
  archivedReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CreateCarDto = Omit<Car, "id" | "createdAt" | "updatedAt">;
