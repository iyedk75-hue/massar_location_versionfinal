import { Archive, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface ArchiveSearchProps {
  message: string;
  query: string;
  onQueryChange: (query: string) => void;
}

export function ArchiveSearch({ message, onQueryChange, query }: ArchiveSearchProps) {
  return (
    <div className="grid gap-4 rounded-xl border border-border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:grid-cols-[1fr_340px]">
      <div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <Input
            className="h-14 rounded-xl border-slate-200 pl-12 text-base shadow-sm dark:border-slate-800 dark:bg-slate-950"
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Rechercher client, voiture, réservation, contrat, paiement..."
            value={query}
          />
        </div>
        <p className="mt-3 text-sm text-muted-foreground dark:text-slate-400">
          Recherche par nom client, CIN, téléphone, immatriculation, contrat, réservation ou montant paiement.
        </p>
      </div>

      <div className="flex items-center gap-4 rounded-xl bg-blue-50 p-4 dark:bg-blue-950/30">
        <RovoAvatar />
        <div className="min-w-0">
          <p className="text-sm font-bold text-blue-900 dark:text-blue-100">Rovo</p>
          <p className="mt-1 text-sm text-blue-800 dark:text-blue-200">{message}</p>
        </div>
      </div>
    </div>
  );
}

function RovoAvatar() {
  return (
    <div className="relative h-20 w-20 shrink-0 animate-bounce-soft">
      <div className="absolute left-4 top-5 h-11 w-12 rounded-[18px] bg-amber-200 shadow-sm ring-1 ring-amber-300" />
      <div className="absolute left-1 top-7 h-7 w-6 rotate-[-18deg] rounded-full bg-amber-300" />
      <div className="absolute right-3 top-7 h-7 w-6 rotate-[18deg] rounded-full bg-amber-300" />
      <div className="absolute left-7 top-8 h-2 w-2 rounded-full bg-slate-900" />
      <div className="absolute right-7 top-8 h-2 w-2 rounded-full bg-slate-900" />
      <div className="absolute left-9 top-11 h-3 w-3 rounded-full bg-slate-900" />
      <div className="absolute left-5 top-2 flex h-5 w-12 items-center justify-center rounded-t-full bg-blue-500 text-white shadow-sm">
        <Archive className="h-3 w-3" />
      </div>
      <div className="absolute bottom-3 right-0 h-7 w-7 rounded-full border-4 border-sky-400 bg-white/50" />
      <div className="absolute bottom-1 right-0 h-4 w-1 rotate-[-40deg] rounded-full bg-sky-500" />
    </div>
  );
}
