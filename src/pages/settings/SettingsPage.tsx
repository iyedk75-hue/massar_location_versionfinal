import { useState } from "react";
import { useForm } from "react-hook-form";
import { PageHeader } from "@/app/layout";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/useToast";
import { loadAISettings, saveAISettings } from "@/services/aiForecastService";
import type { AISettings } from "@/types/aiForecast";
import { notifySettingsChanged, settingsStorageKey } from "@/utils/settings";

type SettingsFormValues = {
  adminName: string;
  agencyName: string;
  agencyPhone: string;
  agencyEmail: string;
  agencyAddress: string;
  adminPin: string;
  autoBackup: boolean;
  autoNumbering: boolean;
  autoYear: boolean;
  contractFolder: string;
  contractPrefix: string;
  currency: string;
  defaultDeposit: number;
  generalConditions: string;
  logoImage: string;
  nextContractNumber: string;
  receiptFolder: string;
  signatureImage: string;
  vatRate: number;
};

const inputClassName = "h-10 w-full rounded-md border border-input bg-white px-3 text-sm";

const defaultSettings: SettingsFormValues = {
  adminName: "",
  agencyName: "",
  agencyPhone: "",
  agencyEmail: "",
  agencyAddress: "",
  adminPin: "",
  autoBackup: true,
  autoNumbering: true,
  autoYear: true,
  contractFolder: "",
  contractPrefix: "",
  currency: "DT",
  defaultDeposit: 0,
  generalConditions: "",
  logoImage: "",
  nextContractNumber: "",
  receiptFolder: "",
  signatureImage: "",
  vatRate: 0,
};

export function SettingsPage() {
  const { showToast } = useToast();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SettingsFormValues>({
    defaultValues: loadSettings(),
  });

  const logoImage = watch("logoImage");
  const signatureImage = watch("signatureImage");

  function submitForm(values: SettingsFormValues) {
    try {
      window.localStorage.setItem(settingsStorageKey, JSON.stringify(values));
      notifySettingsChanged();
      showToast({ title: "Paramètres enregistrés", type: "success" });
    } catch (caught) {
      showToast({ message: getErrorMessage(caught), title: "Erreur paramètres", type: "error" });
    }
  }

  async function handleImageUpload(field: "logoImage" | "signatureImage", file?: File) {
    if (!file) return;

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setValue(field, dataUrl, { shouldDirty: true });
      showToast({ title: "Image chargée", type: "success" });
    } catch (caught) {
      showToast({ message: getErrorMessage(caught), title: "Erreur image", type: "error" });
    }
  }

  return (
    <>
      <PageHeader title="Paramètres" />
      <p className="mb-4 max-w-3xl text-sm text-muted-foreground">
        Configurez les informations de votre agence, les paramètres des contrats et les options de stockage des documents PDF.
      </p>

      <form className="space-y-4" onSubmit={handleSubmit(submitForm)}>
        <SettingsSection title="Informations agence">
          <div className="grid gap-4 md:grid-cols-2">
            <Field error={errors.agencyName?.message} label="Nom de l'agence *">
              <Input
                placeholder="Location Auto Tunis"
                {...register("agencyName", {
                  validate: (value) => value.trim().length > 0 || "Le nom de l'agence est obligatoire.",
                })}
              />
            </Field>
            <Field label="Téléphone">
              <Input placeholder="55 123 456" {...register("agencyPhone")} />
            </Field>
            <Field label="Nom admin">
              <Input placeholder="Nom de l'administrateur" {...register("adminName")} />
            </Field>
            <Field error={errors.agencyEmail?.message} label="Email">
              <Input
                placeholder="contact@agence.com"
                type="email"
                {...register("agencyEmail", {
                  validate: (value) =>
                    !value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) || "L'email n'est pas valide.",
                })}
              />
            </Field>
            <Field label="Adresse">
              <Input placeholder="Rue ... Tunis" {...register("agencyAddress")} />
            </Field>
          </div>
        </SettingsSection>

        <SettingsSection title="Configuration contrat">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Préfixe contrat">
              <Input placeholder="CNT" {...register("contractPrefix")} />
            </Field>
            <Field label="Prochain numéro">
              <Input placeholder="0010" {...register("nextContractNumber")} />
            </Field>
            <CheckboxField label="Année automatique" {...register("autoYear")} />
            <CheckboxField label="Numérotation automatique" {...register("autoNumbering")} />
          </div>
        </SettingsSection>

        <SettingsSection title="Paramètres financiers">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Devise">
              <Input placeholder="DT" {...register("currency")} />
            </Field>
            <Field label="Caution par défaut">
              <Input min="0" type="number" {...register("defaultDeposit", { valueAsNumber: true })} />
            </Field>
            <Field label="TVA (%)">
              <Input min="0" step="0.01" type="number" {...register("vatRate", { valueAsNumber: true })} />
            </Field>
          </div>
        </SettingsSection>

        <SettingsSection title="Modèle de contrat">
          <div className="grid gap-4">
            <Field label="Conditions générales">
              <textarea
                className="min-h-36 w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-ring"
                {...register("generalConditions")}
              />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <ImageField
                image={signatureImage}
                label="Signature agence"
                onChange={(file) => void handleImageUpload("signatureImage", file)}
                onRemove={() => setValue("signatureImage", "", { shouldDirty: true })}
              />
              <ImageField
                image={logoImage}
                label="Logo agence"
                onChange={(file) => void handleImageUpload("logoImage", file)}
                onRemove={() => setValue("logoImage", "", { shouldDirty: true })}
              />
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="Stockage PDF">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Dossier des contrats">
              <Input placeholder="/contracts" {...register("contractFolder")} />
            </Field>
            <Field label="Dossier des reçus">
              <Input placeholder="/receipts" {...register("receiptFolder")} />
            </Field>
          </div>
        </SettingsSection>

        <SettingsSection title="Sécurité">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Code PIN admin">
              <Input placeholder="****" type="password" {...register("adminPin")} />
            </Field>
            <CheckboxField label="Sauvegarde automatique" {...register("autoBackup")} />
          </div>
        </SettingsSection>

        <AISettingsSection />

        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">* Champs obligatoires</p>
          <Button type="submit">Enregistrer les paramètres</Button>
        </div>
      </form>
    </>
  );
}

function SettingsSection({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <Card>
      <CardTitle className="mb-4">{title}</CardTitle>
      {children}
    </Card>
  );
}

function Field({ children, error, label }: { children: React.ReactNode; error?: string; label: string }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

const CheckboxField = ({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
}) => (
  <label className="flex h-10 items-center gap-3 rounded-md border border-border bg-white px-3 text-sm">
    <input className="h-4 w-4" type="checkbox" {...props} />
    {label}
  </label>
);

function ImageField({
  image,
  label,
  onChange,
  onRemove,
}: {
  image: string;
  label: string;
  onChange: (file?: File) => void;
  onRemove: () => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        accept="image/*"
        className={inputClassName}
        onChange={(event) => onChange(event.target.files?.[0])}
        type="file"
      />
      {image && (
        <div className="mt-3 flex items-center gap-3 rounded-md border border-border bg-white p-3">
          <img alt={label} className="h-16 max-w-40 rounded border border-border object-contain" src={image} />
          <Button onClick={onRemove} size="sm" type="button" variant="outline">
            Retirer
          </Button>
        </div>
      )}
    </div>
  );
}

function loadSettings() {
  if (typeof window === "undefined") return defaultSettings;

  const stored = window.localStorage.getItem(settingsStorageKey);
  if (!stored) return defaultSettings;

  try {
    const parsed = JSON.parse(stored) as Partial<SettingsFormValues> & { userName?: unknown };
    const adminName =
      typeof parsed.adminName === "string"
        ? parsed.adminName
        : typeof parsed.userName === "string"
          ? parsed.userName
          : defaultSettings.adminName;

    return { ...defaultSettings, ...parsed, adminName };
  } catch {
    return defaultSettings;
  }
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function getErrorMessage(caught: unknown) {
  return caught instanceof Error ? caught.message : String(caught);
}

function AISettingsSection() {
  const { showToast } = useToast();
  const [aiValues, setAiValues] = useState<AISettings>(() => loadAISettings());

  function update<K extends keyof AISettings>(key: K, value: AISettings[K]) {
    setAiValues((current) => ({ ...current, [key]: value }));
  }

  function handleSave() {
    try {
      saveAISettings(aiValues);
      showToast({ title: "Paramètres IA enregistrés", type: "success" });
    } catch (caught) {
      showToast({ message: getErrorMessage(caught), title: "Erreur paramètres IA", type: "error" });
    }
  }

  return (
    <SettingsSection title="Intelligence artificielle">
      <div className="grid gap-4 md:grid-cols-2">
        <CheckboxField
          checked={aiValues.enabled}
          label="Activer Prévisions IA"
          onChange={(event) => update("enabled", event.currentTarget.checked)}
        />
        <CheckboxField
          checked={aiValues.autoTrain}
          label="Réentraîner automatiquement chaque semaine"
          onChange={(event) => update("autoTrain", event.currentTarget.checked)}
        />
        <Field label="Chemin Python (optionnel)">
          <Input
            onChange={(event) => update("pythonPath", event.target.value)}
            placeholder="python3 ou C:/Python311/python.exe"
            value={aiValues.pythonPath}
          />
        </Field>
        <Field label="Réservations minimum pour entraîner">
          <Input
            min="5"
            onChange={(event) => update("minReservations", Number(event.target.value) || 0)}
            type="number"
            value={aiValues.minReservations}
          />
        </Field>
        <Field label="Dossier local des modèles">
          <Input
            onChange={(event) => update("modelPath", event.target.value)}
            placeholder="ml/models"
            value={aiValues.modelPath}
          />
        </Field>
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={handleSave} type="button" variant="outline">
          Enregistrer les paramètres IA
        </Button>
      </div>
    </SettingsSection>
  );
}
