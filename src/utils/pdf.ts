import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Car } from "@/types/car";
import type { Client } from "@/types/client";
import type { Contract } from "@/types/contract";
import type { Reservation } from "@/types/reservation";
import { formatCarName, formatRegistrationNumber } from "@/utils/car";
import { formatDrivingLicense, formatPhoneNumber, normalizeClientName } from "@/utils/client";
import { formatPeriod } from "@/utils/date";
import { formatMoney } from "@/utils/money";

export async function createContractPdf(
  contract: Contract,
  details: { car?: Car; client?: Client; reservation?: Reservation; secondClient?: Client } = {},
) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  page.drawText(`Contrat de location ${contract.contractNumber}`, {
    x: 48,
    y: 780,
    size: 18,
    font: bold,
    color: rgb(0.05, 0.16, 0.32),
  });

  const lines = [
    "Agence: Massar Location",
    `Reservation: #${contract.reservationId}`,
    `Client: ${details.client ? normalizeClientName(details.client.fullName) : "-"}`,
    `Telephone: ${formatPhoneNumber(details.client?.phone)}`,
    `${formatClientIdentity(details.client)}`,
    `Permis: ${formatDrivingLicense(details.client?.drivingLicense)}`,
    ...(details.secondClient
      ? [
          `Deuxieme conducteur: ${normalizeClientName(details.secondClient.fullName)}`,
          `${formatClientIdentity(details.secondClient)}`,
          `Permis 2e conducteur: ${formatDrivingLicense(details.secondClient.drivingLicense)}`,
        ]
      : []),
    `Voiture: ${details.car ? formatCarName(details.car.brand, details.car.model) : "-"}`,
    `Immatriculation: ${details.car ? formatRegistrationNumber(details.car.registrationNumber) : "-"}`,
    `Dates: ${formatPeriod(details.reservation?.startDate, details.reservation?.endDate)}`,
    `Prix total: ${formatMoney(details.reservation?.totalPrice ?? 0)}`,
    `Caution: ${formatMoney(details.reservation?.depositAmount ?? 0)}`,
    `Kilometrage depart: ${details.reservation?.pickupMileage ?? details.car?.mileage ?? "-"}`,
    `Carburant depart: ${details.reservation?.pickupFuelLevel ?? "-"}`,
    "",
    "Conditions generales:",
    "- Le client restitue le vehicule dans l'etat initial.",
    "- Les retards, dommages et penalites sont factures par l'agence.",
    "- La caution ne remplace pas le paiement de location.",
    "",
    "Signature agence: ____________________",
    "Signature client: ____________________",
  ];

  lines.forEach((line, index) => {
    page.drawText(line, {
      x: 48,
      y: 735 - index * 24,
      size: line.endsWith(":") ? 12 : 10,
      font: line.endsWith(":") ? bold : font,
    });
  });

  return pdfDoc.save();
}

function formatClientIdentity(client?: Client) {
  if (!client) return "Piece: -";
  if (client.cin) return `CIN: ${client.cin}`;
  if (client.passportNumber) return `Passeport: ${client.passportNumber}`;
  return "Piece: -";
}
