import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Heart,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Star,
  UserCheck,
  UserX,
  Users,
  type LucideIcon,
} from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ClientForm } from "@/pages/clients/ClientForm";
import { createClient, deactivateClient, getClients, reactivateClient, updateClient } from "@/services/client.service";
import { getReservations } from "@/services/reservation.service";
import type { Client, CreateClientDto } from "@/types/client";
import type { Reservation } from "@/types/reservation";
import { formatDrivingLicense, formatPhoneNumber, normalizeClientName } from "@/utils/client";
import { formatShortPeriod } from "@/utils/date";
import { formatMoney } from "@/utils/money";
import { useToast } from "@/hooks/useToast";

const CLIENTS_PER_PAGE = 9;

export function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [detailsClient, setDetailsClient] = useState<Client | null>(null);
  const [selectedClientIds, setSelectedClientIds] = useState<number[]>([]);
  const [bulkActionsOpen, setBulkActionsOpen] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    void reload();
  }, []);

  async function reload() {
    const [clientsData, reservationsData] = await Promise.all([getClients(), getReservations()]);
    setClients(clientsData);
    setReservations(reservationsData);
  }

  const filteredClients = useMemo(
    () =>
      clients
        .filter((client) => {
          if (statusFilter === "ACTIVE") return isClientActive(client);
          if (statusFilter === "INACTIVE") return !isClientActive(client);
          return true;
        })
        .filter((client) =>
          `${normalizeClientName(client.fullName)} ${client.phone} ${formatPhoneNumber(client.phone)} ${client.cin ?? ""} ${
            client.passportNumber ?? ""
          } ${client.drivingLicense ?? ""}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        ),
    [clients, query, statusFilter],
  );

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter]);

  useEffect(() => {
    setSelectedClientIds((current) => current.filter((id) => clients.some((client) => client.id === id)));
  }, [clients]);

  const locationsByClient = useMemo(() => {
    const counts = new Map<number, number>();
    reservations.forEach((reservation) => {
      counts.set(reservation.clientId, (counts.get(reservation.clientId) ?? 0) + 1);
      if (reservation.secondClientId) {
        counts.set(reservation.secondClientId, (counts.get(reservation.secondClientId) ?? 0) + 1);
      }
    });
    return counts;
  }, [reservations]);

  const lastReservationByClient = useMemo(() => {
    const latest = new Map<number, Reservation>();

    reservations.forEach((reservation) => {
      [reservation.clientId, reservation.secondClientId].forEach((clientId) => {
        if (!clientId) return;
        const current = latest.get(clientId);
        if (!current || getTime(reservation.startDate) > getTime(current.startDate)) {
          latest.set(clientId, reservation);
        }
      });
    });

    return latest;
  }, [reservations]);

  const stats = useMemo(() => {
    const active = clients.filter(isClientActive).length;
    const inactive = clients.length - active;
    const loyal = clients.filter((client) => (locationsByClient.get(client.id) ?? 0) > 5).length;
    const createdThisMonth = clients.filter((client) => isInCurrentMonth(client.createdAt)).length;

    return {
      active,
      activePercent: clients.length ? Math.round((active / clients.length) * 100) : 0,
      createdThisMonth,
      inactive,
      inactivePercent: clients.length ? Math.round((inactive / clients.length) * 100) : 0,
      loyal,
      loyalPercent: clients.length ? Math.round((loyal / clients.length) * 100) : 0,
      total: clients.length,
    };
  }, [clients, locationsByClient]);

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / CLIENTS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paginatedClients = filteredClients.slice((safePage - 1) * CLIENTS_PER_PAGE, safePage * CLIENTS_PER_PAGE);
  const firstItem = filteredClients.length ? (safePage - 1) * CLIENTS_PER_PAGE + 1 : 0;
  const lastItem = Math.min(safePage * CLIENTS_PER_PAGE, filteredClients.length);
  const selectedClientIdsSet = useMemo(() => new Set(selectedClientIds), [selectedClientIds]);
  const selectedClients = useMemo(
    () => clients.filter((client) => selectedClientIdsSet.has(client.id)),
    [clients, selectedClientIdsSet],
  );
  const visibleClientIds = paginatedClients.map((client) => client.id);
  const allVisibleClientsSelected = visibleClientIds.length > 0 && visibleClientIds.every((id) => selectedClientIdsSet.has(id));

  function toggleClientSelection(id: number) {
    setSelectedClientIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleVisibleClients() {
    setSelectedClientIds((current) => {
      if (allVisibleClientsSelected) return current.filter((id) => !visibleClientIds.includes(id));
      return Array.from(new Set([...current, ...visibleClientIds]));
    });
  }

  async function handleSelectedClientStatus(action: "activate" | "deactivate") {
    const targets = selectedClients.filter((client) => (action === "activate" ? !isClientActive(client) : isClientActive(client)));

    if (!selectedClients.length) {
      showToast({ message: "Cochez au moins un client dans la liste.", title: "Aucune sélection", type: "info" });
      setBulkActionsOpen(false);
      return;
    }

    if (!targets.length) {
      showToast({
        message: action === "activate" ? "Les clients sélectionnés sont déjà actifs." : "Les clients sélectionnés sont déjà désactivés.",
        title: "Aucun changement",
        type: "info",
      });
      setBulkActionsOpen(false);
      return;
    }

    if (action === "deactivate" && !window.confirm(`Désactiver ${targets.length} client${targets.length > 1 ? "s" : ""} sélectionné${targets.length > 1 ? "s" : ""} ?`)) {
      setBulkActionsOpen(false);
      return;
    }

    try {
      const updatedClients = await Promise.all(
        targets.map((client) => (action === "activate" ? reactivateClient(client.id) : deactivateClient(client.id))),
      );
      const updatedById = new Map(updatedClients.map((client) => [client.id, client]));

      setClients((current) => current.map((client) => updatedById.get(client.id) ?? client));
      setSelectedClientIds([]);
      setBulkActionsOpen(false);
      showToast({
        title: action === "activate" ? "Clients activés" : "Clients désactivés",
        type: "success",
      });
    } catch (caught) {
      showToast({ message: getErrorMessage(caught), title: "Action impossible", type: "error" });
    }
  }

  async function handleSubmit(data: CreateClientDto) {
    try {
      if (editingClient) {
        const client = await updateClient(editingClient.id, normalizeClientPayload(data));
        setClients((current) => current.map((item) => (item.id === client.id ? client : item)));
        showToast({ title: "Client modifié", type: "success" });
      } else {
        const client = await createClient(normalizeClientPayload(data));
        setClients((current) => [client, ...current]);
        showToast({ title: "Client ajouté", type: "success" });
      }
      setEditingClient(null);
      setOpen(false);
    } catch (caught) {
      showToast({ message: getErrorMessage(caught), title: "Erreur client", type: "error" });
    }
  }

  async function handleDeactivate(id: number) {
    if (!window.confirm("Désactiver ce client ? Il restera visible dans l'historique.")) return;
    try {
      const client = await deactivateClient(id);
      setClients((current) => current.map((item) => (item.id === id ? client : item)));
      showToast({ title: "Client désactivé", type: "success" });
    } catch (caught) {
      showToast({ message: getErrorMessage(caught), title: "Désactivation impossible", type: "error" });
    }
  }

  async function handleReactivate(id: number) {
    try {
      const client = await reactivateClient(id);
      setClients((current) => current.map((item) => (item.id === id ? client : item)));
      showToast({ title: "Client réactivé", type: "success" });
    } catch (caught) {
      showToast({ message: getErrorMessage(caught), title: "Réactivation impossible", type: "error" });
    }
  }

  const history = reservations.filter(
    (reservation) => reservation.clientId === detailsClient?.id || reservation.secondClientId === detailsClient?.id,
  );

  return (
    <>
      <div className="space-y-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal text-slate-900">Clients</h1>
            <p className="mt-1 text-sm text-muted-foreground">Gérez vos clients et consultez leurs informations</p>
          </div>
          <Dialog
            onOpenChange={(value) => {
              setOpen(value);
              if (!value) setEditingClient(null);
            }}
            open={open}
          >
            <DialogTrigger asChild>
              <Button className="h-11 self-start rounded-lg px-5 shadow-sm">
                <Plus className="h-4 w-4" />
                Ajouter client
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[92vh] w-[min(96vw,700px)] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingClient ? "Modifier un client" : "Ajouter un client"}</DialogTitle>
              </DialogHeader>
              <ClientForm defaultValues={editingClient ?? undefined} onSubmit={handleSubmit} />
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            accent="blue"
            detail={`+${stats.createdThisMonth} ce mois`}
            icon={Users}
            label="Total clients"
            value={stats.total}
          />
          <StatCard
            accent="emerald"
            detail={`${stats.activePercent}%`}
            icon={UserCheck}
            label="Clients actifs"
            value={stats.active}
          />
          <StatCard
            accent="amber"
            detail={`${stats.loyalPercent}%`}
            icon={Star}
            label="Clients fidèles"
            value={stats.loyal}
          />
          <StatCard
            accent="rose"
            detail={`${stats.inactivePercent}%`}
            icon={Heart}
            label="Clients inactifs"
            value={stats.inactive}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(260px,1fr)_220px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="h-11 rounded-lg border-slate-200 bg-white pl-10 shadow-sm"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher (nom, téléphone, CIN...)"
              value={query}
            />
          </div>
          <select
            className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-600 shadow-sm outline-none transition-smooth focus:ring-2 focus:ring-ring focus:ring-offset-2"
            onChange={(event) => setStatusFilter(event.target.value as "ALL" | "ACTIVE" | "INACTIVE")}
            value={statusFilter}
          >
            <option value="ALL">Tous les statuts</option>
            <option value="ACTIVE">Clients actifs</option>
            <option value="INACTIVE">Clients inactifs</option>
          </select>
          <div className="relative">
            <Button
              className="h-11 w-full rounded-lg border-slate-200 bg-white px-5 shadow-sm"
              onClick={() => setBulkActionsOpen((current) => !current)}
              type="button"
              variant="outline"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filtres
            </Button>
            {bulkActionsOpen && (
              <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                <p className="px-2 pb-2 text-xs font-medium text-slate-500">
                  {selectedClientIds.length} client{selectedClientIds.length > 1 ? "s" : ""} sélectionné{selectedClientIds.length > 1 ? "s" : ""}
                </p>
                <button
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!selectedClientIds.length}
                  onClick={() => void handleSelectedClientStatus("activate")}
                  type="button"
                >
                  <UserCheck className="h-4 w-4" />
                  Activer sélection
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!selectedClientIds.length}
                  onClick={() => void handleSelectedClientStatus("deactivate")}
                  type="button"
                >
                  <UserX className="h-4 w-4" />
                  Désactiver sélection
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-100/80 text-xs uppercase text-slate-500">
                <tr>
                  <th className="w-14 px-5 py-4">
                    <input
                      aria-label="Sélectionner les clients visibles"
                      checked={allVisibleClientsSelected}
                      className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                      disabled={!visibleClientIds.length}
                      onChange={toggleVisibleClients}
                      type="checkbox"
                    />
                  </th>
                  <th className="px-5 py-4 font-semibold">Client</th>
                  <th className="px-5 py-4 font-semibold">Téléphone</th>
                  <th className="px-5 py-4 font-semibold">Permis</th>
                  <th className="px-5 py-4 font-semibold">Locations</th>
                  <th className="px-5 py-4 font-semibold">Dernière location</th>
                  <th className="px-5 py-4 font-semibold">Statut</th>
                  <th className="px-5 py-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedClients.length ? (
                  paginatedClients.map((client) => {
                    const locationsCount = locationsByClient.get(client.id) ?? 0;
                    const lastReservation = lastReservationByClient.get(client.id);

                    return (
                      <tr
                        className={`transition-colors ${
                          selectedClientIdsSet.has(client.id) ? "bg-blue-50/70 hover:bg-blue-50" : "hover:bg-slate-50/80"
                        }`}
                        key={client.id}
                      >
                        <td className="px-5 py-4">
                          <input
                            aria-label={`Sélectionner ${normalizeClientName(client.fullName)}`}
                            checked={selectedClientIdsSet.has(client.id)}
                            className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                            onChange={() => toggleClientSelection(client.id)}
                            type="checkbox"
                          />
                        </td>
                        <td className="px-5 py-4">
                          <ClientIdentity client={client} locationsCount={locationsCount} />
                        </td>
                        <td className="px-5 py-4 font-medium text-slate-700">{formatPhoneNumber(client.phone)}</td>
                        <td className="px-5 py-4 text-slate-600">{formatDrivingLicense(client.drivingLicense)}</td>
                        <td className="px-5 py-4 font-semibold text-slate-700">{locationsCount}</td>
                        <td className="px-5 py-4 font-medium text-slate-700">
                          {lastReservation ? formatReadableDate(lastReservation.startDate) : "-"}
                        </td>
                        <td className="px-5 py-4">
                          <ClientStatusBadge isActive={isClientActive(client)} />
                        </td>
                        <td className="px-5 py-4">
                          <ClientActions
                            client={client}
                            onDeactivate={handleDeactivate}
                            onEdit={() => {
                              setEditingClient(client);
                              setOpen(true);
                            }}
                            onReactivate={handleReactivate}
                            onView={() => setDetailsClient(client)}
                          />
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="px-5 py-10 text-center text-muted-foreground" colSpan={8}>
                      Aucun client trouvé
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>
            Affichage de {firstItem} à {lastItem} sur {filteredClients.length} clients
            {selectedClientIds.length > 0 ? ` · ${selectedClientIds.length} sélectionné${selectedClientIds.length > 1 ? "s" : ""}` : ""}
          </p>
          <Pagination currentPage={safePage} onPageChange={setPage} totalPages={totalPages} />
        </div>
      </div>

      <Dialog onOpenChange={(value) => !value && setDetailsClient(null)} open={Boolean(detailsClient)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Détails client</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {detailsClient && (
              <div className="rounded-md border border-border p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{normalizeClientName(detailsClient.fullName)}</p>
                  <div className="flex items-center gap-2">
                    {(locationsByClient.get(detailsClient.id) ?? 0) > 5 && <LoyaltyBadge />}
                    <ClientStatusBadge isActive={isClientActive(detailsClient)} />
                  </div>
                </div>
                <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                  <DetailItem label="Téléphone" value={formatPhoneNumber(detailsClient.phone)} />
                  {detailsClient.birthDate && <DetailItem label="Date de naissance" value={formatIsoDate(detailsClient.birthDate)} />}
                  {detailsClient.birthPlace && <DetailItem label="Lieu de naissance" value={detailsClient.birthPlace} />}
                  {detailsClient.nationality && <DetailItem label="Nationalité" value={detailsClient.nationality} />}
                  {detailsClient.cin && <DetailItem label="CIN" value={detailsClient.cin} />}
                  {detailsClient.cinIssueDate && <DetailItem label="Obtention CIN" value={formatIsoDate(detailsClient.cinIssueDate)} />}
                  {detailsClient.cinIssuePlace && <DetailItem label="Lieu CIN" value={detailsClient.cinIssuePlace} />}
                  {detailsClient.passportNumber && <DetailItem label="Passeport" value={detailsClient.passportNumber} />}
                  <DetailItem label="Permis" value={formatDrivingLicense(detailsClient.drivingLicense)} />
                  {detailsClient.drivingLicenseDate && (
                    <DetailItem label="Obtention permis" value={formatIsoDate(detailsClient.drivingLicenseDate)} />
                  )}
                  {detailsClient.address && <DetailItem label="Adresse" value={detailsClient.address} />}
                  <DetailItem label="Locations" value={String(locationsByClient.get(detailsClient.id) ?? 0)} />
                </dl>
              </div>
            )}
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune location pour ce client.</p>
            ) : (
              history.map((reservation) => (
                <div className="rounded-md border border-border p-3 text-sm" key={reservation.id}>
                  <div className="flex items-center justify-between">
                    <span>Réservation #{reservation.id}</span>
                    <StatusBadge status={reservation.status} />
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {formatShortPeriod(reservation.startDate, reservation.endDate)} | {formatMoney(reservation.totalPrice)}
                  </p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function normalizeClientPayload(data: CreateClientDto): CreateClientDto {
  return {
    ...data,
    fullName: normalizeClientName(data.fullName),
    phone: data.phone.trim(),
    cin: cleanOptional(data.cin),
    passportNumber: cleanOptional(data.passportNumber),
    drivingLicense: cleanOptional(data.drivingLicense),
    drivingLicenseDate: data.drivingLicenseDate || null,
    cinIssueDate: data.cinIssueDate || null,
    cinIssuePlace: data.cinIssuePlace || null,
    birthDate: data.birthDate || null,
    birthPlace: data.birthPlace || null,
    nationality: data.nationality || null,
    address: data.address || null,
  };
}

function cleanOptional(value?: string | null) {
  const cleaned = value?.trim() ?? "";
  return cleaned || null;
}

function formatIsoDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatReadableDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function getTime(iso: string) {
  const time = new Date(iso).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function isInCurrentMonth(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  return !Number.isNaN(date.getTime()) && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function isClientActive(client: Client) {
  return client.isActive !== false;
}

function ClientIdentity({ client, locationsCount }: { client: Client; locationsCount: number }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <ClientAvatar name={client.fullName} />
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className={isClientActive(client) ? "truncate font-semibold text-slate-800" : "truncate font-semibold text-slate-500"}>
            {normalizeClientName(client.fullName)}
          </span>
          {locationsCount > 5 && <LoyaltyBadge />}
        </div>
        <p className="mt-0.5 text-xs text-slate-500">CIN: {client.cin || client.passportNumber || "-"}</p>
      </div>
    </div>
  );
}

function ClientAvatar({ name }: { name: string }) {
  const initials = normalizeClientName(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const palette = [
    "bg-violet-100 text-violet-700",
    "bg-sky-100 text-sky-700",
    "bg-emerald-100 text-emerald-700",
    "bg-orange-100 text-orange-700",
    "bg-rose-100 text-rose-700",
    "bg-amber-100 text-amber-700",
  ];
  const color = palette[name.length % palette.length];

  return (
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${color}`}>
      {initials || "CL"}
    </span>
  );
}

function ClientActions({
  client,
  onDeactivate,
  onEdit,
  onReactivate,
  onView,
}: {
  client: Client;
  onDeactivate: (id: number) => void;
  onEdit: () => void;
  onReactivate: (id: number) => void;
  onView: () => void;
}) {
  return (
    <div className="flex justify-end gap-1">
      <Button aria-label="Voir" className="h-8 w-8 text-slate-500 hover:text-primary" onClick={onView} size="icon" title="Voir" variant="ghost">
        <Eye className="h-4 w-4" />
      </Button>
      <Button
        aria-label="Modifier"
        className="h-8 w-8 text-slate-500 hover:text-primary"
        onClick={onEdit}
        size="icon"
        title="Modifier"
        variant="ghost"
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        aria-label={isClientActive(client) ? "Désactiver" : "Réactiver"}
        className="h-8 w-8 rounded-full border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-primary"
        onClick={() => (isClientActive(client) ? onDeactivate(client.id) : onReactivate(client.id))}
        size="icon"
        title={isClientActive(client) ? "Désactiver" : "Réactiver"}
        variant="ghost"
      >
        <MoreVertical className="h-4 w-4" />
      </Button>
    </div>
  );
}

function ClientStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={
        isActive
          ? "inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200"
          : "inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200"
      }
    >
      {isActive ? "Actif" : "Inactif"}
    </span>
  );
}

function LoyaltyBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
      <Star className="h-3 w-3 fill-current" />
      Fidèle
    </span>
  );
}

function Pagination({
  currentPage,
  onPageChange,
  totalPages,
}: {
  currentPage: number;
  onPageChange: (page: number) => void;
  totalPages: number;
}) {
  const pages = buildPagination(currentPage, totalPages);

  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        aria-label="Page précédente"
        className="h-9 w-9 rounded-lg border-slate-200"
        disabled={currentPage === 1}
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        size="icon"
        variant="outline"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {pages.map((item, index) =>
        item === "ellipsis" ? (
          <span className="px-2 text-slate-400" key={`${item}-${index}`}>
            ...
          </span>
        ) : (
          <Button
            className={
              item === currentPage
                ? "h-9 w-9 rounded-lg border-blue-200 bg-white text-primary shadow-sm"
                : "h-9 w-9 rounded-lg border-slate-200 bg-white text-slate-600"
            }
            key={item}
            onClick={() => onPageChange(item)}
            size="icon"
            variant="outline"
          >
            {item}
          </Button>
        ),
      )}
      <Button
        aria-label="Page suivante"
        className="h-9 w-9 rounded-lg border-slate-200"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        size="icon"
        variant="outline"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function buildPagination(currentPage: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, "ellipsis", totalPages];
  }

  if (currentPage >= totalPages - 2) {
    return [1, "ellipsis", totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, "ellipsis", currentPage, "ellipsis", totalPages];
}

function StatCard({
  accent,
  detail,
  icon: Icon,
  label,
  value,
}: {
  accent: "amber" | "blue" | "emerald" | "rose";
  detail: string;
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  const styles = {
    amber: {
      icon: "bg-amber-50 text-amber-500 ring-amber-100",
      text: "text-amber-600",
    },
    blue: {
      icon: "bg-blue-50 text-blue-600 ring-blue-100",
      text: "text-emerald-600",
    },
    emerald: {
      icon: "bg-emerald-50 text-emerald-600 ring-emerald-100",
      text: "text-emerald-600",
    },
    rose: {
      icon: "bg-rose-50 text-rose-500 ring-rose-100",
      text: "text-slate-500",
    },
  }[accent];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <span className={`flex h-11 w-11 items-center justify-center rounded-full ring-1 ${styles.icon}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs font-semibold text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold leading-none text-slate-900">{value}</p>
          <p className={`mt-2 text-xs font-semibold ${styles.text}`}>{detail}</p>
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function getErrorMessage(caught: unknown) {
  return caught instanceof Error ? caught.message : String(caught);
}
