import { useEffect, useMemo, useState } from "react";
import { Archive, Download, Settings, Sparkles, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArchiveDataGrid } from "@/pages/archive/components/ArchiveDataGrid";
import { ArchiveDetailsDrawer } from "@/pages/archive/components/ArchiveDetailsDrawer";
import { ArchiveSearch } from "@/pages/archive/components/ArchiveSearch";
import { ArchiveStats } from "@/pages/archive/components/ArchiveStats";
import { ArchiveTabs, type ArchiveTab } from "@/pages/archive/components/ArchiveTabs";
import { PermanentDeleteDialog } from "@/pages/archive/components/PermanentDeleteDialog";
import { RestoreArchiveDialog } from "@/pages/archive/components/RestoreArchiveDialog";
import {
  getArchivedItems,
  getArchiveStats,
  permanentlyDeleteArchivedItem,
  restoreArchivedItem,
  searchArchivedItems,
} from "@/services/archiveService";
import type { ArchiveItem, ArchiveStats as ArchiveStatsType } from "@/types/archive";
import { useToast } from "@/hooks/useToast";

const emptyStats: ArchiveStatsType = {
  cars: 0,
  clients: 0,
  contracts: 0,
  payments: 0,
  reservations: 0,
  total: 0,
};

export function ArchivePage() {
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [stats, setStats] = useState<ArchiveStatsType>(emptyStats);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<ArchiveTab>("all");
  const [detailsItem, setDetailsItem] = useState<ArchiveItem | null>(null);
  const [restoreItem, setRestoreItem] = useState<ArchiveItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<ArchiveItem | null>(null);
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [cleanupAge, setCleanupAge] = useState<"6m" | "1y">("6m");
  const [cleanupWithoutDependencies, setCleanupWithoutDependencies] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    void reload();
  }, []);

  async function reload() {
    const [nextItems, nextStats] = await Promise.all([getArchivedItems(), getArchiveStats()]);
    setItems(nextItems);
    setStats(nextStats);
  }

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesType = activeTab === "all" || item.type === activeTab;
      const haystack = `${item.title} ${item.subtitle ?? ""} ${item.description ?? ""} ${item.status ?? ""} ${
        item.archivedReason ?? ""
      } ${JSON.stringify(item.originalData)}`.toLowerCase();
      const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
      return matchesType && matchesQuery;
    });
  }, [activeTab, items, query]);

  const rovoMessage = query.trim()
    ? filteredItems.length
      ? `J’ai trouvé ${filteredItems.length} résultat(s).`
      : "Aucun résultat trouvé."
    : "Je peux vous aider à retrouver un ancien client, contrat ou paiement.";

  async function handleSearch(nextQuery: string) {
    setQuery(nextQuery);
    if (nextQuery.trim()) {
      const results = await searchArchivedItems(nextQuery, activeTab);
      setItems((current) => mergeKnownItems(current, results));
    }
  }

  async function handleRestore() {
    if (!restoreItem) return;
    await restoreArchivedItem(restoreItem.type, restoreItem.id);
    setRestoreItem(null);
    await reload();
    showToast({ title: "Élément restauré avec succès", type: "success" });
  }

  async function handlePermanentDelete() {
    if (!deleteItem) return;
    await permanentlyDeleteArchivedItem(deleteItem.type, deleteItem.id);
    setDeleteItem(null);
    await reload();
    showToast({ title: "Élément supprimé définitivement", type: "success" });
  }

  function handleExport(item?: ArchiveItem) {
    const payload = JSON.stringify(item ?? filteredItems, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = item ? `archive-${item.type}-${item.id}.json` : "rentaldesk-archive.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleCleanupArchives() {
    const cutoff = Date.now() - (cleanupAge === "6m" ? 183 : 365) * 24 * 60 * 60 * 1000;
    const targets = items.filter((item) => {
      const archivedTime = item.archivedAt ? new Date(item.archivedAt).getTime() : 0;
      if (!Number.isFinite(archivedTime) || archivedTime > cutoff) return false;
      if (!cleanupWithoutDependencies) return true;
      return item.type === "payment" || item.type === "contract";
    });

    await Promise.all(targets.map((item) => permanentlyDeleteArchivedItem(item.type, item.id)));
    setCleanupOpen(false);
    await reload();
    showToast({
      message: `${targets.length} élément(s) supprimé(s) définitivement.`,
      title: "Nettoyage terminé",
      type: "success",
    });
  }

  return (
    <div className="animate-slide-in-up space-y-5 dark:bg-slate-950">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Archive className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-slate-950 dark:text-slate-100">Archive</h1>
              <p className="mt-1 text-sm text-muted-foreground dark:text-slate-400">
                Consultez, recherchez et restaurez les anciens éléments de votre agence
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => handleExport()} type="button" variant="outline">
            <Download className="h-4 w-4" />
            Exporter archive
          </Button>
          <Button onClick={() => setCleanupOpen(true)} type="button" variant="outline">
            <Trash2 className="h-4 w-4" />
            Nettoyer archives
          </Button>
          <Button onClick={() => setSettingsOpen(true)} type="button" variant="outline">
            <Settings className="h-4 w-4" />
            Paramètres archive
          </Button>
        </div>
      </div>

      <ArchiveStats stats={stats} />
      <ArchiveSearch message={rovoMessage} onQueryChange={handleSearch} query={query} />
      <ArchiveTabs active={activeTab} onChange={setActiveTab} />

      {filteredItems.length ? (
        <ArchiveDataGrid
          items={filteredItems}
          onDelete={setDeleteItem}
          onExport={handleExport}
          onRestore={setRestoreItem}
          onView={setDetailsItem}
        />
      ) : (
        <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
          <Sparkles className="h-12 w-12 text-blue-600" />
          <h2 className="mt-4 text-xl font-bold text-slate-950 dark:text-slate-100">Aucune archive pour le moment</h2>
          <p className="mt-2 text-sm text-muted-foreground dark:text-slate-400">
            Les éléments supprimés ou archivés apparaîtront ici.
          </p>
          <Button className="mt-5" onClick={() => navigate("/")} type="button">
            Retour au tableau de bord
          </Button>
        </div>
      )}

      <ArchiveDetailsDrawer item={detailsItem} onClose={() => setDetailsItem(null)} open={Boolean(detailsItem)} />
      <RestoreArchiveDialog item={restoreItem} onCancel={() => setRestoreItem(null)} onConfirm={handleRestore} open={Boolean(restoreItem)} />
      <PermanentDeleteDialog
        item={deleteItem}
        onCancel={() => setDeleteItem(null)}
        onConfirm={handlePermanentDelete}
        open={Boolean(deleteItem)}
      />

      <Dialog onOpenChange={setCleanupOpen} open={cleanupOpen}>
        <DialogContent className="w-[min(92vw,520px)] dark:border-slate-800 dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle>Nettoyer archives</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
            <label className="flex items-center gap-2 rounded-lg border border-border p-3 dark:border-slate-800">
              <input
                checked={cleanupAge === "6m"}
                className="h-4 w-4 accent-blue-600"
                name="cleanup"
                onChange={() => setCleanupAge("6m")}
                type="radio"
              />
              Supprimer archives de plus de 6 mois
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-border p-3 dark:border-slate-800">
              <input
                checked={cleanupAge === "1y"}
                className="h-4 w-4 accent-blue-600"
                name="cleanup"
                onChange={() => setCleanupAge("1y")}
                type="radio"
              />
              Supprimer archives de plus de 1 an
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-border p-3 dark:border-slate-800">
              <input
                checked={cleanupWithoutDependencies}
                className="h-4 w-4 accent-blue-600"
                onChange={(event) => setCleanupWithoutDependencies(event.target.checked)}
                type="checkbox"
              />
              Supprimer uniquement les éléments sans dépendances
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setCleanupOpen(false)} type="button" variant="outline">
              Annuler
            </Button>
            <Button
              onClick={() => void handleCleanupArchives()}
              type="button"
              variant="destructive"
            >
              Confirmer nettoyage
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={setSettingsOpen} open={settingsOpen}>
        <DialogContent className="w-[min(92vw,480px)] dark:border-slate-800 dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle>Paramètres archive</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground dark:text-slate-400">
            Les suppressions importantes sont converties en archive logique. La suppression définitive reste disponible uniquement depuis cette page.
          </p>
          <div className="flex justify-end">
            <Button onClick={() => setSettingsOpen(false)} type="button">
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function mergeKnownItems(current: ArchiveItem[], results: ArchiveItem[]) {
  const byKey = new Map(current.map((item) => [`${item.type}-${item.id}`, item]));
  results.forEach((item) => byKey.set(`${item.type}-${item.id}`, item));
  return Array.from(byKey.values());
}
