export interface Client {
  id: number;
  fullName: string;
  phone: string;
  cin?: string | null;
  passportNumber?: string | null;
  drivingLicense?: string | null;
  drivingLicenseDate?: string | null;
  cinIssueDate?: string | null;
  cinIssuePlace?: string | null;
  birthDate?: string | null;
  birthPlace?: string | null;
  nationality?: string | null;
  address?: string | null;
  isActive: boolean;
  archived?: boolean | null;
  archivedAt?: string | null;
  archivedReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CreateClientDto = Omit<Client, "id" | "isActive" | "createdAt" | "updatedAt"> & {
  isActive?: boolean;
};
