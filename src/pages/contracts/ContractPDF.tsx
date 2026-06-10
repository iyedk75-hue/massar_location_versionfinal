import type { Car } from "@/types/car";
import type { Client } from "@/types/client";
import type { Contract } from "@/types/contract";
import type { Reservation } from "@/types/reservation";
import { formatCarName, formatRegistrationNumber } from "@/utils/car";
import { formatDrivingLicense, formatPhoneNumber, normalizeClientName } from "@/utils/client";
import { formatPeriod } from "@/utils/date";
import { formatMoney } from "@/utils/money";

export function ContractPDF({
  car,
  client,
  contract,
  reservation,
  secondClient,
}: {
  car?: Car;
  client?: Client;
  contract: Contract;
  reservation?: Reservation;
  secondClient?: Client;
}) {
  return (
    <div className="contract-print-sheet space-y-6 bg-white p-8 text-sm">
      <header className="border-b border-border pb-4">
        <h2 className="text-2xl font-semibold">Contrat de location</h2>
        <p className="text-muted-foreground">{contract.contractNumber}</p>
      </header>
      <section className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-2 font-semibold">Agence</h3>
          <p>Massar Location</p>
          <p>Tunis, Tunisie</p>
        </div>
        <div>
          <h3 className="mb-2 font-semibold">Client</h3>
          <p>{client ? normalizeClientName(client.fullName) : "-"}</p>
          <p>{formatPhoneNumber(client?.phone)}</p>
          <p>{formatClientIdentity(client)}</p>
          <p>Permis : {formatDrivingLicense(client?.drivingLicense)}</p>
          {secondClient && (
            <div className="mt-3 border-t border-border pt-3">
              <p className="font-medium">Deuxième conducteur</p>
              <p>{normalizeClientName(secondClient.fullName)}</p>
              <p>{formatClientIdentity(secondClient)}</p>
              <p>Permis : {formatDrivingLicense(secondClient.drivingLicense)}</p>
            </div>
          )}
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-2 font-semibold">Voiture</h3>
          <p>{car ? formatCarName(car.brand, car.model) : "-"}</p>
          <p>{car ? formatRegistrationNumber(car.registrationNumber) : "-"}</p>
          <p>Kilometrage depart : {reservation?.pickupMileage ?? car?.mileage ?? "-"}</p>
          <p>Carburant depart : {reservation?.pickupFuelLevel ?? "-"}</p>
        </div>
        <div>
          <h3 className="mb-2 font-semibold">Location</h3>
          <p>
            {formatPeriod(reservation?.startDate, reservation?.endDate)}
          </p>
          <p>Total : {formatMoney(reservation?.totalPrice ?? 0)}</p>
          <p>Caution : {formatMoney(reservation?.depositAmount ?? 0)}</p>
        </div>
      </section>
      <section>
        <h3 className="mb-2 font-semibold">Conditions generales</h3>
        <p>Le client s'engage a restituer le vehicule dans l'etat initial, avec les niveaux declares au depart.</p>
        <p>Les penalites, dommages et retards sont factures selon les conditions de l'agence.</p>
      </section>
      <footer className="grid grid-cols-2 gap-8 pt-12">
        <div className="border-t border-border pt-2">Signature agence</div>
        <div className="border-t border-border pt-2">Signature client</div>
      </footer>
    </div>
  );
}

function formatClientIdentity(client?: Client) {
  if (!client) return "Pièce : -";
  if (client.cin) return `CIN : ${client.cin}`;
  if (client.passportNumber) return `Passeport : ${client.passportNumber}`;
  return "Pièce : -";
}
