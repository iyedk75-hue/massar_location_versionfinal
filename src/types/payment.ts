export type PaymentType = "RENTAL_PAYMENT" | "DEPOSIT" | "DEPOSIT_REFUND" | "PENALTY";
export type PaymentMethod = "CASH" | "CARD" | "BANK_TRANSFER" | "CHECK";

export interface Payment {
  id: number;
  reservationId: number;
  amount: number;
  type: PaymentType;
  method: PaymentMethod;
  paymentDate: string;
  note?: string | null;
  archived?: boolean | null;
  archivedAt?: string | null;
  archivedReason?: string | null;
  createdAt: string;
}

export type CreatePaymentDto = Omit<Payment, "id" | "createdAt">;
