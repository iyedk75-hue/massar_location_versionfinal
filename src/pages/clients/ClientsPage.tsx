import { useEffect, useMemo, useState } from "react";
import {
  Eye,
  Heart,
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
import { Card } from "@/components/ui/card";
import { DataGridActionMenu } from "@/components/ui/action-menu/DataGridActionMenu";
import { AppPagination } from "@/components/ui/pagination/AppPagination";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { ClientForm } from "@/pages/clients/ClientForm";
import { createClient, deactivateClient, getClients, reactivateClient, updateClient } from "@/services/client.service";
import { getReservations } from "@/services/reservation.service";
import type { Client, CreateClientDto } from "@/types/client";
import type { Reservation } from "@/types/reservation";
import { formatDrivingLicense, formatPhoneNumber, normalizeClientName } from "@/utils/client";
import { formatShortPeriod } from "@/utils/date";
import { formatMoney } from "@/utils/money";
import { useToast } from "@/hooks/useToast";
import { useConfirmAction } from "@/hooks/useConfirmAction";
import { readStoredPageSize, writeStoredPageSize } from "@/lib/pagination";

const clientsPageSizeKey = "massar-pagination-page-size-clients";
const clientStatusFilterOptions = [
  { value: "ALL", label: "Tous les statuts" },
  { value: "ACTIVE", label: "Clients actifs" },
  { value: "INACTIVE", label: "Clients inactifs" },
];

export function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => readStoredPageSize(clientsPageSizeKey));
  const [open, setOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [detailsClient, setDetailsClient] = useState<Client | null>(null);
  const [selectedClientIds, setSelectedClientIds] = useState<number[]>([]);
  const [bulkActionsOpen, setBulkActionsOpen] = useState(false);
  const { confirmAction } = useConfirmAction();
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
  }, [pageSize, query, statusFilter]);

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

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedClients = filteredClients.slice((safePage - 1) * pageSize, safePage * pageSize);
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

  function handlePageSizeChange(nextPageSize: number) {
    setPageSize(nextPageSize);
    writeStoredPageSize(clientsPageSizeKey, nextPageSize);
  }

  function handleSelectedClientStatus(action: "activate" | "deactivate") {
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

    const isActivation = action === "activate";
    confirmAction({
      action: isActivation ? "reactiver" : "désactiver",
      confirmLabel: isActivation ? "Activer" : "Désactiver",
      description: `${targets.length} client${targets.length > 1 ? "s" : ""} seront ${isActivation ? "activés" : "désactivés"}.`,
      title: isActivation ? "Activer la sélection ?" : "Désactiver la sélection ?",
      onConfirm: async () => {
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
      },
    });
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

  function handleDeactivate(id: number) {
    confirmAction({
      action: "désactiver",
      confirmLabel: "Désactiver",
      description: "Le client restera visible dans l'historique, mais ne sera plus actif.",
      title: "Désactiver ce client ?",
      onConfirm: async () => {
        try {
          const client = await deactivateClient(id);
          setClients((current) => current.map((item) => (item.id === id ? client : item)));
          showToast({ title: "Client désactivé", type: "success" });
        } catch (caught) {
          showToast({ message: getErrorMessage(caught), title: "Désactivation impossible", type: "error" });
        }
      },
    });
  }

  function handleReactivate(id: number) {
    confirmAction({
      action: "réactiver",
      confirmLabel: "Réactiver",
      description: "Le client redeviendra actif dans l'application.",
      title: "Réactiver ce client ?",
      onConfirm: async () => {
        try {
          const client = await reactivateClient(id);
          setClients((current) => current.map((item) => (item.id === id ? client : item)));
          showToast({ title: "Client réactivé", type: "success" });
        } catch (caught) {
          showToast({ message: getErrorMessage(caught), title: "Réactivation impossible", type: "error" });
        }
      },
    });
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
          <SearchableSelect
            ariaLabel="Filtrer les clients par statut"
            className="h-11 rounded-lg border-slate-200 text-slate-600"
            onValueChange={(nextValue) => setStatusFilter(nextValue as "ALL" | "ACTIVE" | "INACTIVE")}
            options={clientStatusFilterOptions}
            value={statusFilter}
          />
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
                  onClick={() => handleSelectedClientStatus("activate")}
                  type="button"
                >
                  <UserCheck className="h-4 w-4" />
                  Activer sélection
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!selectedClientIds.length}
                  onClick={() => handleSelectedClientStatus("deactivate")}
                  type="button"
                >
                  <UserX className="h-4 w-4" />
                  Désactiver sélection
                </button>
              </div>
            )}
          </div>
        </div>

        <Card className="overflow-hidden p-0 dark:bg-slate-900 dark:border-slate-800">
          <div className="w-full overflow-x-auto md:overflow-x-visible">
            <table className="w-full min-w-[760px] table-fixed text-left text-sm md:min-w-0">
              <thead>
                <tr className="border-b border-border bg-slate-50 dark:bg-slate-950">
                  <th className="w-10 px-3 py-3">
                    <input
                      aria-label="Sélectionner les clients visibles"
                      checked={allVisibleClientsSelected}
                      className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                      disabled={!visibleClientIds.length}
                      onChange={toggleVisibleClients}
                      type="checkbox"
                    />
                  </th>
                  <th className="min-w-0 px-2 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Client</th>
                  <th className="w-[112px] px-2 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:w-[130px]">Téléphone</th>
                  <th className="w-[106px] px-2 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:w-[124px]">Permis</th>
                  <th className="w-[72px] px-2 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:w-[86px]">Loc.</th>
                  <th className="w-[118px] px-2 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:w-[140px]">Dernière</th>
                  <th className="w-[86px] px-2 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:w-[100px]">Statut</th>
                  <th className="w-[118px] px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:w-[132px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedClients.length ? (
                  paginatedClients.map((client) => {
                    const locationsCount = locationsByClient.get(client.id) ?? 0;
                    const lastReservation = lastReservationByClient.get(client.id);

                    return (
                      <tr
                        className={`border-b border-border last:border-0 transition ${
                          selectedClientIdsSet.has(client.id)
                            ? "bg-blue-50/70 hover:bg-blue-50 dark:bg-blue-950/30 dark:hover:bg-blue-950/40"
                            : "hover:bg-slate-50/60 dark:hover:bg-slate-950/40"
                        }`}
                        key={client.id}
                      >
                        <td className="w-10 px-3 py-3">
                          <input
                            aria-label={`Sélectionner ${normalizeClientName(client.fullName)}`}
                            checked={selectedClientIdsSet.has(client.id)}
                            className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                            onChange={() => toggleClientSelection(client.id)}
                            type="checkbox"
                          />
                        </td>
                        <td className="min-w-0 overflow-hidden px-2 py-3">
                          <ClientIdentity client={client} locationsCount={locationsCount} />
                        </td>
                        <td className="overflow-hidden whitespace-nowrap px-2 py-3 font-medium text-foreground">
                          <span className="block truncate">{formatPhoneNumber(client.phone)}</span>
                        </td>
                        <td className="overflow-hidden whitespace-nowrap px-2 py-3 text-muted-foreground">
                          <span className="block truncate">{formatDrivingLicense(client.drivingLicense)}</span>
                        </td>
                        <td className="overflow-hidden whitespace-nowrap px-2 py-3 font-semibold text-foreground">{locationsCount}</td>
                        <td className="overflow-hidden whitespace-nowrap px-2 py-3 font-medium text-foreground">
                          <span className="block truncate">{lastReservation ? formatReadableDate(lastReservation.startDate) : "-"}</span>
                        </td>
                        <td className="overflow-hidden px-2 py-3">
                          <ClientStatusBadge isActive={isClientActive(client)} />
                        </td>
                        <td className="px-3 py-3">
                          <ClientActions
                            client={client}
                            onDeactivate={handleDeactivate}
                            onEdit={() => {
                              setEditingClient(client);
                              setOpen(true);
                            }}
                            onReactivate={handleReactivate}
                          />
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="px-4 py-10 text-center text-sm text-muted-foreground" colSpan={8}>
                      Aucun client trouvé
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {selectedClientIds.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {selectedClientIds.length} sélectionné{selectedClientIds.length > 1 ? "s" : ""}
          </p>
        )}
        <AppPagination
          currentPage={safePage}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
          pageSize={pageSize}
          totalItems={filteredClients.length}
          totalPages={totalPages}
        />
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
    <div className="flex min-w-0 items-center gap-2 lg:gap-3">
      <ClientAvatar name={client.fullName} />
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className={isClientActive(client) ? "truncate font-semibold text-foreground" : "truncate font-semibold text-muted-foreground"}>
            {normalizeClientName(client.fullName)}
          </span>
          {locationsCount > 5 && <LoyaltyBadge />}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{client.cin ? `CIN: ${client.cin}` : `Passport: ${client.passportNumber}`}</p>
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
    "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  ];
  const color = palette[name.length % palette.length];

  return (
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold lg:h-10 lg:w-10 ${color}`}>
      {initials || "CL"}
    </span>
  );
}

function ClientActions({
  client,
  onDeactivate,
  onEdit,
  onReactivate,
}: {
  client: Client;
  onDeactivate: (id: number) => void;
  onEdit: () => void;
  onReactivate: (id: number) => void;
}) {
  const active = isClientActive(client);

  return (
    <div className="flex justify-end">
      <DataGridActionMenu
        actions={[
          { href: `/clients/${client.id}`, icon: Eye, label: "Voir détails" },
          { icon: Pencil, label: "Modifier", onClick: onEdit },
          active
            ? { destructive: true, icon: UserX, label: "Désactiver", onClick: () => onDeactivate(client.id) }
            : { icon: UserCheck, label: "Réactiver", onClick: () => onReactivate(client.id) },
        ]}
      />
    </div>
  );
}

function ClientStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={
        isActive
          ? "inline-flex max-w-full rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:ring-emerald-900"
          : "inline-flex max-w-full rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:ring-rose-900"
      }
    >
      <span className="truncate">{isActive ? "Actif" : "Inactif"}</span>
    </span>
  );
}

function LoyaltyBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:ring-amber-900">
      <Star className="h-3 w-3 fill-current" />
      Fidèle
    </span>
  );
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
