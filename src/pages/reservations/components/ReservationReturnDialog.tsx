import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import type { Car } from "@/types/car";
import { formatCarName, formatRegistrationNumber } from "@/utils/car";

const fuelLevels = ["Plein", "3/4", "1/2", "1/4", "Vide"];
const fuelLevelOptions = fuelLevels.map((level) => ({ value: level, label: level }));

type ReservationReturnDialogProps = {
  car?: Car;
  fuelLevel: string;
  mileage: string;
  onConfirm: () => void;
  onFuelLevelChange: (value: string) => void;
  onMileageChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function ReservationReturnDialog({
  car,
  fuelLevel,
  mileage,
  onConfirm,
  onFuelLevelChange,
  onMileageChange,
  onOpenChange,
  open,
}: ReservationReturnDialogProps) {
  const currentMileage = car?.mileage ?? 0;
  const mileageRequired = !mileage.trim();
  const invalidMileage = mileageRequired || !Number.isFinite(Number(mileage)) || Number(mileage) < currentMileage;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Retour voiture</DialogTitle>
        </DialogHeader>
        {car && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {formatCarName(car.brand, car.model)} - {formatRegistrationNumber(car.registrationNumber)}
            </p>
            <div>
              <Label>Kilométrage retour (km)</Label>
              <Input
                min={currentMileage}
                onChange={(event) => onMileageChange(event.target.value)}
                placeholder={`Ex: ${currentMileage + 500}`}
                required
                type="number"
                value={mileage}
              />
              {mileageRequired && <p className="mt-1 text-xs text-destructive">Le kilométrage retour est obligatoire.</p>}
              {!mileageRequired && invalidMileage && (
                <p className="mt-1 text-xs text-destructive">
                  Le kilométrage retour doit être supérieur ou égal à {formatMileage(currentMileage)}.
                </p>
              )}
            </div>
            <div>
              <Label>Niveau carburant au retour</Label>
              <SearchableSelect
                ariaLabel="Sélectionner le niveau carburant au retour"
                onValueChange={onFuelLevelChange}
                options={fuelLevelOptions}
                searchPlaceholder="Rechercher un niveau..."
                value={fuelLevel}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
                Annuler
              </Button>
              <Button className="bg-emerald-600 text-white hover:bg-emerald-700" disabled={invalidMileage} onClick={onConfirm} type="button">
                <CheckCircle2 className="h-4 w-4" />
                Confirmer retour
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function formatMileage(value?: number | null) {
  if (!Number.isFinite(value)) return "-";
  return `${new Intl.NumberFormat("fr-TN", { maximumFractionDigits: 0 }).format(Number(value))} km`;
}
