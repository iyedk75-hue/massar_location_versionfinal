import { useEffect, useMemo, useState } from "react";
import { Archive, Download, Settings, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArchiveDataGrid } from "@/pages/archive/components/ArchiveDataGrid";
import { ArchiveDetailsDrawer } from "@/pages/archive/components/ArchiveDetailsDrawer";
import { ArchiveEmptyDog } from "@/pages/archive/components/ArchiveEmptyDog";
import { ArchiveSearch } from "@/pages/archive/components/ArchiveSearch";
import { ArchiveStats } from "@/pages/archive/components/ArchiveStats";
import { ArchiveTabs, type ArchiveTab } from "@/pages/archive/components/ArchiveTabs";
import {
  getArchivedItems,
  getArchiveStats,
  permanentlyDeleteArchivedItem,
  restoreArchivedItem,
  searchArchivedItems,
} from "@/services/archiveService";
import type { ArchiveItem, ArchiveStats as ArchiveStatsType } from "@/types/archive";
import { useConfirmAction } from "@/hooks/useConfirmAction";
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
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [cleanupAge, setCleanupAge] = useState<"6m" | "1y">("6m");
  const [cleanupWithoutDependencies, setCleanupWithoutDependencies] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { confirmAction } = useConfirmAction();
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
      ? `J'ai trouvé ${filteredItems.length} résultat${filteredItems.length > 1 ? "s" : ""}.`
      : "Aucun résultat trouvé."
    : "Je peux vous aider à retrouver un ancien client, contrat, paiement ou véhicule.";

  async function handleSearch(nextQuery: string) {
    setQuery(nextQuery);
    if (nextQuery.trim()) {
      const results = await searchArchivedItems(nextQuery, activeTab);
      setItems((current) => mergeKnownItems(current, results));
    }
  }

  async function handleRestore(item: ArchiveItem) {
    await restoreArchivedItem(item.type, item.id);
    await reload();
    showToast({ title: "Élément restauré avec succès", type: "success" });
  }

  async function handlePermanentDelete(item: ArchiveItem) {
    await permanentlyDeleteArchivedItem(item.type, item.id);
    await reload();
    showToast({ title: "Élément supprimé définitivement", type: "success" });
  }

  function handleExport(item?: ArchiveItem) {
    const payload = JSON.stringify(item ?? filteredItems, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = item ? `archive-${item.type}-${item.id}.json` : "massar-location-archive.json";
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
      message: `${targets.length} élément${targets.length > 1 ? "s" : ""} supprimé${targets.length > 1 ? "s" : ""} définitivement.`,
      title: "Nettoyage terminé",
      type: "success",
    });
  }

  return (
    <div className="animate-slide-in-up space-y-5 bg-[#f4f7fb] dark:bg-slate-950">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-gradient-to-br from-[#3a5cf0] to-[#1f3bbf] text-white shadow-[0_6px_16px_rgba(39,70,214,0.30)]">
            <Archive className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-[28px] font-extrabold leading-tight tracking-normal text-[#0f1f3d] dark:text-slate-100">Archive</h1>
            <p className="mt-1 text-sm text-muted-foreground dark:text-slate-400">
              Consultez, recherchez et restaurez les anciens éléments de votre agence
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button className="rounded-[11px] border-slate-200 bg-white px-4 shadow-sm transition-smooth hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800" onClick={() => handleExport()} type="button" variant="outline">
            <Download className="h-4 w-4" />
            Exporter archive
          </Button>
          <Button className="rounded-[11px] border-slate-200 bg-white px-4 shadow-sm transition-smooth hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800" onClick={() => setCleanupOpen(true)} type="button" variant="outline">
            <Trash2 className="h-4 w-4" />
            Nettoyer archives
          </Button>
          <Button className="rounded-[11px] border-slate-200 bg-white px-4 shadow-sm transition-smooth hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800" onClick={() => setSettingsOpen(true)} type="button" variant="outline">
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
          onDelete={(item) =>
            confirmAction({
              action: "supprimer",
              confirmLabel: "Supprimer définitivement",
              description: `Cette action est irréversible pour "${item.title}".`,
              title: "Supprimer définitivement ?",
              onConfirm: () => handlePermanentDelete(item),
            })
          }
          onExport={handleExport}
          onRestore={(item) =>
            confirmAction({
              action: "restaurer",
              confirmLabel: "Restaurer",
              description: `"${item.title}" sera restauré dans son espace d'origine.`,
              title: "Restaurer cet élément ?",
              onConfirm: () => handleRestore(item),
            })
          }
          onView={setDetailsItem}
        />
      ) : (
        <ArchiveEmptyState onBack={() => navigate("/")} />
      )}

      <ArchiveDetailsDrawer item={detailsItem} onClose={() => setDetailsItem(null)} open={Boolean(detailsItem)} />

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
              onClick={() =>
                confirmAction({
                  action: "nettoyer",
                  confirmLabel: "Confirmer nettoyage",
                  description: "Les archives correspondant aux critères sélectionnés seront supprimées définitivement.",
                  title: "Nettoyer les archives ?",
                  onConfirm: handleCleanupArchives,
                })
              }
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

function ArchiveEmptyState({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center overflow-hidden rounded-[14px] border-[1.5px] border-dashed border-[#d6dfee] bg-white px-6 py-14 text-center dark:border-slate-800 dark:bg-slate-900">
      <ArchiveEmptyDog />

      <h2 className="text-[22px] font-extrabold text-[#0f1f3d] dark:text-slate-100">Aucune archive pour le moment</h2>
      <p className="mt-2 max-w-md text-[14.5px] text-muted-foreground dark:text-slate-400">
        Les éléments supprimés ou archivés apparaîtront ici.
      </p>
      <Button className="mt-6 rounded-[11px] bg-[#1a2f93] px-4 shadow-[0_6px_14px_rgba(26,47,147,0.25)] hover:bg-[#142578]" onClick={onBack} type="button">
        Retour au tableau de bord
      </Button>
    </div>
  );
}

function mergeKnownItems(current: ArchiveItem[], results: ArchiveItem[]) {
  const byKey = new Map(current.map((item) => [`${item.type}-${item.id}`, item]));
  results.forEach((item) => byKey.set(`${item.type}-${item.id}`, item));
  return Array.from(byKey.values());
}
