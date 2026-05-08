import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { Ban, CalendarDays, CarFront, CheckCircle2, FileText, Pencil, Phone, Play, WalletCards, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import type { Reservation } from "@/types/reservation";
import { formatCarName, formatRegistrationNumber } from "@/utils/car";
import { formatPhoneNumber, normalizeClientName } from "@/utils/client";
import { formatDateTime, formatRentalDuration } from "@/utils/date";
import { formatMoney } from "@/utils/money";
import { cn } from "@/lib/utils";
import { getClientIdentity, type ReservationViewModel } from "@/pages/reservations/components/reservationViewUtils";

interface ReservationQuickDetailsProps {
  item: ReservationViewModel | null;
  onGenerateContract: (reservationId: number) => void | Promise<void>;
  onClose: () => void;
  onEdit: (reservation: Reservation) => void;
  onStatusChange: (id: number, status: Reservation["status"]) => void | Promise<void>;
  open: boolean;
}

export function ReservationQuickDetails({
  item,
  onClose,
  onEdit,
  onGenerateContract,
  onStatusChange,
  open,
}: ReservationQuickDetailsProps) {
  const reservation = item?.reservation;

  return (
    <DialogPrimitive.Root onOpenChange={(value) => !value && onClose()} open={open}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-slate-950/45 data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
        <DialogPrimitive.Content className="fixed right-0 top-0 z-50 flex h-full w-[min(96vw,520px)] flex-col border-l border-border bg-white shadow-2xl outline-none data-[state=open]:animate-slide-in-right data-[state=closed]:animate-slide-out-right dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-start justify-between gap-4 border-b border-border p-5 dark:border-slate-800">
            <div>
              <DialogPrimitive.Title className="text-xl font-bold text-slate-950 dark:text-slate-100">
                Détails réservation
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground dark:text-slate-400">
                Vue rapide du client, du véhicule, des paiements et du contrat.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close asChild>
              <Button aria-label="Fermer" size="icon" type="button" variant="ghost">
                <X className="h-4 w-4" />
              </Button>
            </DialogPrimitive.Close>
          </div>

          {item && reservation ? (
            <>
              <div className="flex-1 space-y-4 overflow-y-auto p-5">
                <Section icon={<Phone className="h-4 w-4" />} title="Client">
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-950 dark:text-slate-100">
                      {item.client ? normalizeClientName(item.client.fullName) : "Client inconnu"}
                    </p>
                    <p>{formatPhoneNumber(item.client?.phone)}</p>
                    <p>{getClientIdentity(item.client)}</p>
                    {item.secondClient && (
                      <div className="mt-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-900">
                        <p className="text-xs font-semibold text-muted-foreground dark:text-slate-400">Deuxième conducteur</p>
                        <p className="font-medium text-slate-950 dark:text-slate-100">{normalizeClientName(item.secondClient.fullName)}</p>
                        <p>{getClientIdentity(item.secondClient)}</p>
                      </div>
                    )}
                  </div>
                </Section>

                <Section icon={<CarFront className="h-4 w-4" />} title="Voiture">
                  <div className="flex items-center gap-3">
                    {item.car?.imageUrl ? (
                      <img
                        alt={formatCarName(item.car.brand, item.car.model)}
                        className="h-16 w-24 rounded-xl object-cover"
                        src={item.car.imageUrl}
                      />
                    ) : (
                      <div className="flex h-16 w-24 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                        <CarFront className="h-7 w-7" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-950 dark:text-slate-100">
                        {item.car ? formatCarName(item.car.brand, item.car.model) : "Voiture inconnue"}
                      </p>
                      <p>{item.car ? formatRegistrationNumber(item.car.registrationNumber) : "Immatriculation -"}</p>
                      <p>{item.car?.fuelType || "-"}</p>
                    </div>
                  </div>
                </Section>

                <Section icon={<CalendarDays className="h-4 w-4" />} title="Période">
                  <div className="grid grid-cols-2 gap-3">
                    <DetailValue label="Départ" value={formatDateTime(reservation.startDate)} />
                    <DetailValue label="Retour" value={formatDateTime(reservation.endDate)} />
                  </div>
                  <p className="mt-3 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">
                    {formatRentalDuration(reservation.startDate, reservation.endDate)}
                  </p>
                </Section>

                <Section icon={<WalletCards className="h-4 w-4" />} title="Paiements">
                  <div className="grid grid-cols-3 gap-3">
                    <DetailValue label="Total dû" value={formatMoney(reservation.totalPrice)} />
                    <DetailValue label="Payé" value={formatMoney(item.paid)} />
                    <DetailValue label="Reste" value={formatMoney(item.remaining)} />
                  </div>
                </Section>

                <Section icon={<FileText className="h-4 w-4" />} title="Caution et contrat">
                  <div className="grid grid-cols-2 gap-3">
                    <DetailValue label="Caution" value={formatMoney(reservation.depositAmount)} />
                    <DetailValue label="Statut caution" value={item.depositCollected > 0 ? "Encaissée" : "À encaisser"} />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-900">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Contrat</span>
                    <Button onClick={() => void onGenerateContract(reservation.id)} size="sm" type="button" variant="outline">
                      Voir contrat
                    </Button>
                  </div>
                </Section>

                <Section icon={<CheckCircle2 className="h-4 w-4" />} title="Statut">
                  <StatusBadge status={reservation.status} />
                  <p className="mt-3 text-xs text-muted-foreground dark:text-slate-400">Créée le : {formatDateTime(reservation.createdAt)}</p>
                </Section>
              </div>

              <div className="border-t border-border p-5 dark:border-slate-800">
                <div className="flex flex-wrap justify-end gap-2">
                  <Button onClick={() => onEdit(reservation)} type="button" variant="outline">
                    <Pencil className="h-4 w-4" />
                    Modifier
                  </Button>
                  {(reservation.status === "EN_ATTENTE" || reservation.status === "RESERVED") && (
                    <Button onClick={() => void onStatusChange(reservation.id, "ONGOING")} type="button">
                      <Play className="h-4 w-4" />
                      Démarrer
                    </Button>
                  )}
                  {reservation.status === "ONGOING" && (
                    <Button onClick={() => void onStatusChange(reservation.id, "COMPLETED")} type="button">
                      <CheckCircle2 className="h-4 w-4" />
                      Terminer
                    </Button>
                  )}
                  {reservation.status !== "COMPLETED" && reservation.status !== "CANCELLED" && (
                    <Button onClick={() => void onStatusChange(reservation.id, "CANCELLED")} type="button" variant="destructive">
                      <Ban className="h-4 w-4" />
                      Annuler
                    </Button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="p-5 text-sm text-muted-foreground dark:text-slate-400">Aucune réservation trouvée</div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Section({ children, icon, title }: { children: ReactNode; icon: ReactNode; title: string }) {
  return (
    <section className="rounded-xl border border-border bg-white p-4 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
      <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground dark:text-slate-400">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-200">
          {icon}
        </span>
        {title}
      </div>
      {children}
    </section>
  );
}

function DetailValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground dark:text-slate-400">{label}</p>
      <p className={cn("mt-1 break-words font-semibold text-slate-950 dark:text-slate-100")}>{value}</p>
    </div>
  );
}
