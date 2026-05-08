import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Banknote,
  Brain,
  CalendarRange,
  CheckCircle2,
  Database,
  Gauge,
  Loader2,
  PlayCircle,
  RefreshCcw,
  TestTube2,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { PageHeader } from "@/app/layout";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, CardValue } from "@/components/ui/card";
import { useToast } from "@/hooks/useToast";
import {
  getAIModelStatus,
  runAIForecast,
  seedAISampleData,
  trainAIModels,
} from "@/services/aiForecastService";
import type {
  AIClientSegment,
  AIDailyPoint,
  AIForecastResult,
  AIForecastResultSuccess,
  AIModelStatus,
} from "@/types/aiForecast";
import { formatMoney } from "@/utils/money";

export function AIForecastPage() {
  const { showToast } = useToast();
  const [status, setStatus] = useState<AIModelStatus | null>(null);
  const [forecast, setForecast] = useState<AIForecastResult | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [training, setTraining] = useState(false);
  const [predicting, setPredicting] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);

  useEffect(() => {
    void refreshStatus();
  }, []);

  async function refreshStatus() {
    try {
      setStatusLoading(true);
      const next = await getAIModelStatus();
      setStatus(next);
    } catch (error) {
      showToast({
        title: "Erreur",
        message: getErrorMessage(error),
        type: "error",
      });
    } finally {
      setStatusLoading(false);
    }
  }

  async function handleTrain() {
    try {
      setTraining(true);
      const result = await trainAIModels();
      if (result.success) {
        showToast({
          title: "Modèles entraînés",
          message: result.message,
          type: "success",
        });
      } else {
        showToast({
          title: "Entraînement impossible",
          message: result.message,
          type: "error",
        });
      }
      await refreshStatus();
    } catch (error) {
      showToast({
        title: "Erreur entraînement",
        message: getErrorMessage(error),
        type: "error",
      });
    } finally {
      setTraining(false);
    }
  }

  async function handleSeedSampleData() {
    try {
      setSeeding(true);
      const result = await seedAISampleData();
      showToast({
        title: "Données de test créées",
        message: result.message,
        type: "success",
      });
      await refreshStatus();
    } catch (error) {
      showToast({
        title: "Erreur génération test",
        message: getErrorMessage(error),
        type: "error",
      });
    } finally {
      setSeeding(false);
    }
  }

  async function handlePredict() {
    try {
      setPredicting(true);
      const result = await runAIForecast();
      setForecast(result);
      if (result.success) {
        showToast({
          title: "Prédiction générée",
          message: `Confiance modèle : ${(result.modelConfidence * 100).toFixed(0)}%`,
          type: "success",
        });
      } else {
        showToast({
          title: "Prédiction impossible",
          message: result.message,
          type: "error",
        });
      }
    } catch (error) {
      showToast({
        title: "Erreur prédiction",
        message: getErrorMessage(error),
        type: "error",
      });
    } finally {
      setPredicting(false);
    }
  }

  const successForecast = forecast && forecast.success ? forecast : null;
  const showEmptyState =
    !statusLoading && !successForecast && (!status?.trained || forecast?.success === false);

  return (
    <>
      <PageHeader title="Autre">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={training || predicting || seeding || !status?.trained}
            onClick={() => void handlePredict()}
            type="button"
          >
            {predicting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4" />
            )}
            Lancer la prédiction
          </Button>
          <Button
            disabled={training || predicting || seeding}
            onClick={() => void handleSeedSampleData()}
            type="button"
            variant="secondary"
          >
            {seeding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <TestTube2 className="h-4 w-4" />
            )}
            Générer des données test
          </Button>
          <Button
            disabled={training || predicting || seeding}
            onClick={() => void handleTrain()}
            type="button"
            variant="outline"
          >
            {training ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            Réentraîner le modèle
          </Button>
        </div>
      </PageHeader>

      <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
        Analyse locale et prédictions intelligentes de l'activité de votre agence. Tous les calculs
        sont exécutés sur votre machine - aucune donnée n'est envoyée sur Internet.
      </p>

      <ModelStatusCard
        loading={statusLoading}
        status={status}
        forecast={successForecast}
      />

      {successForecast ? (
        <ForecastView forecast={successForecast} />
      ) : showEmptyState ? (
        <EmptyState
          message={
            forecast && !forecast.success
              ? forecast.message
              : "Ajoutez plus de réservations et de paiements pour obtenir des prévisions fiables."
          }
        />
      ) : (
        <PendingHint hasStatus={Boolean(status)} trained={Boolean(status?.trained)} />
      )}
    </>
  );
}

function ModelStatusCard({
  forecast,
  loading,
  status,
}: {
  forecast: AIForecastResultSuccess | null;
  loading: boolean;
  status: AIModelStatus | null;
}) {
  return (
    <Card className="mb-6 dark:bg-slate-900 dark:border-slate-800">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-xl ${
              status?.trained
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                : "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
            }`}
          >
            {status?.trained ? (
              <CheckCircle2 className="h-6 w-6" />
            ) : (
              <Brain className="h-6 w-6" />
            )}
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">
              {loading
                ? "Vérification du modèle..."
                : status?.trained
                ? "Modèle entraîné"
                : "Modèle non entraîné"}
            </p>
            <p className="text-sm text-muted-foreground">
              {loading
                ? "Recherche des fichiers .pkl locaux"
                : status?.trained
                ? `Dernier entraînement : ${formatDateTime(status.lastTrainedAt)}`
                : "Lancez l'entraînement pour activer les prédictions."}
            </p>
            {status && !status.pythonAvailable && (
              <p className="mt-1 flex items-center gap-2 text-xs text-orange-600 dark:text-orange-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                {status.message ??
                  "Python n'est pas disponible. Installez-le ou configurez son chemin dans les paramètres."}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatusPill
            icon={<Database className="h-4 w-4" />}
            label="Modèles trouvés"
            value={status?.modelsFound.length ?? 0}
          />
          <StatusPill
            icon={<Gauge className="h-4 w-4" />}
            label="Confiance"
            value={
              forecast
                ? `${Math.round(forecast.modelConfidence * 100)}%`
                : status?.trained
                ? "-"
                : "-"
            }
          />
          <StatusPill
            icon={<CalendarRange className="h-4 w-4" />}
            label="Période"
            value={forecast ? forecast.dataPeriod : "-"}
          />
        </div>
      </div>
    </Card>
  );
}

function StatusPill({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-lg border border-border bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950">
      <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ForecastView({ forecast }: { forecast: AIForecastResultSuccess }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          accent="text-emerald-600 dark:text-emerald-400"
          icon={<Banknote className="h-5 w-5" />}
          label="CA prévu (7 jours)"
          value={formatMoney(forecast.revenue.next7Days)}
          hint={forecast.revenue.trend !== "n/a" ? `Tendance ${forecast.revenue.trend}` : undefined}
        />
        <KpiCard
          accent="text-blue-600 dark:text-blue-400"
          icon={<TrendingUp className="h-5 w-5" />}
          label="CA prévu (30 jours)"
          value={formatMoney(forecast.revenue.next30Days)}
        />
        <KpiCard
          accent="text-orange-600 dark:text-orange-400"
          icon={<Activity className="h-5 w-5" />}
          label="Demande prévue (30j)"
          value={`${forecast.demand.next30DaysReservations} réservations`}
          hint={
            forecast.demand.peakDays.length
              ? `Pics : ${forecast.demand.peakDays.join(", ")}`
              : undefined
          }
        />
        <KpiCard
          accent="text-violet-600 dark:text-violet-400"
          icon={<Gauge className="h-5 w-5" />}
          label="Confiance modèle"
          value={`${Math.round(forecast.modelConfidence * 100)}%`}
        />
      </div>

      <RevenueChartCard
        history={forecast.revenueHistory ?? []}
        forecastPoints={forecast.revenueForecast ?? []}
      />

      <DemandChartCard points={forecast.demandForecast ?? []} />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <TopCarsCard cars={forecast.topCars} />
        <SegmentsCard segments={forecast.clientSegments} />
      </div>

      <RecommendationsCard recommendations={forecast.recommendations} />
    </div>
  );
}

function KpiCard({
  accent,
  hint,
  icon,
  label,
  value,
}: {
  accent: string;
  hint?: string;
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card className="dark:bg-slate-900 dark:border-slate-800">
      <div className={`flex items-center gap-2 text-sm font-medium ${accent}`}>
        {icon}
        <span className="text-muted-foreground">{label}</span>
      </div>
      <CardValue className="mt-3 text-2xl font-semibold">{value}</CardValue>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

function RevenueChartCard({
  forecastPoints,
  history,
}: {
  forecastPoints: AIDailyPoint[];
  history: AIDailyPoint[];
}) {
  const allPoints = useMemo(
    () => [...history.map((point) => ({ ...point, type: "history" as const })),
           ...forecastPoints.map((point) => ({ ...point, type: "forecast" as const }))],
    [history, forecastPoints],
  );

  if (allPoints.length === 0) {
    return null;
  }

  const max = Math.max(...allPoints.map((point) => point.value), 1);

  return (
    <Card className="dark:bg-slate-900 dark:border-slate-800">
      <div className="mb-4 flex items-center justify-between">
        <CardTitle className="text-base font-semibold text-foreground">
          Revenus (réels vs prédits)
        </CardTitle>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <LegendDot color="bg-slate-400" /> Historique
          <LegendDot color="bg-blue-500" /> Prévision
        </div>
      </div>
      <div className="flex h-52 items-end gap-1">
        {allPoints.map((point) => (
          <div
            className="flex-1 flex flex-col items-center justify-end gap-1"
            key={`${point.type}-${point.date}`}
            title={`${point.date} - ${formatMoney(point.value)}`}
          >
            <div
              className={`w-full rounded-t-sm ${
                point.type === "history"
                  ? "bg-slate-300 dark:bg-slate-700"
                  : "bg-blue-500 dark:bg-blue-400"
              }`}
              style={{ height: `${Math.max(2, (point.value / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
    </Card>
  );
}

function DemandChartCard({ points }: { points: AIDailyPoint[] }) {
  if (points.length === 0) return null;
  const max = Math.max(...points.map((point) => point.value), 1);

  return (
    <Card className="dark:bg-slate-900 dark:border-slate-800">
      <div className="mb-4 flex items-center justify-between">
        <CardTitle className="text-base font-semibold text-foreground">
          Demande prévue par jour
        </CardTitle>
        <span className="text-xs text-muted-foreground">7 prochains jours</span>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {points.map((point) => (
          <div
            className="flex flex-col items-center gap-1 rounded-md border border-border bg-slate-50 p-2 text-center text-xs dark:border-slate-800 dark:bg-slate-950"
            key={point.date}
          >
            <span className="text-muted-foreground">{shortWeekday(point.date)}</span>
            <span className="text-base font-semibold text-foreground">
              {Math.round(point.value)}
            </span>
            <div className="flex h-12 w-full items-end">
              <div
                className="w-full rounded-sm bg-orange-500 dark:bg-orange-400"
                style={{ height: `${Math.max(8, (point.value / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function TopCarsCard({ cars }: { cars: AIForecastResultSuccess["topCars"] }) {
  return (
    <Card className="dark:bg-slate-900 dark:border-slate-800">
      <CardTitle className="mb-4 text-base font-semibold text-foreground">
        Voitures les plus demandées
      </CardTitle>
      {cars.length === 0 ? (
        <p className="text-sm text-muted-foreground">Pas encore de prédiction par voiture.</p>
      ) : (
        <ul className="space-y-3">
          {cars.map((car) => (
            <li
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
              key={car.carName}
            >
              <div>
                <p className="font-semibold text-foreground">{car.carName}</p>
                <p className="text-xs text-muted-foreground">
                  {car.expectedReservations} réservations attendues
                </p>
              </div>
              <div className="flex w-40 items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-blue-500 dark:bg-blue-400"
                    style={{ width: `${Math.round(car.score * 100)}%` }}
                  />
                </div>
                <span className="w-10 text-right text-sm font-semibold text-foreground">
                  {Math.round(car.score * 100)}%
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function SegmentsCard({ segments }: { segments: AIClientSegment[] }) {
  return (
    <Card className="dark:bg-slate-900 dark:border-slate-800">
      <CardTitle className="mb-4 text-base font-semibold text-foreground">
        Segments clients
      </CardTitle>
      {segments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Pas encore de segmentation disponible.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {segments.map((segment) => (
            <li
              className="rounded-md border border-border bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
              key={segment.name}
            >
              <p className="text-sm font-semibold text-foreground">{segment.name}</p>
              <p className="text-xl font-semibold text-blue-600 dark:text-blue-400">
                {segment.count}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{segment.description}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RecommendationsCard({ recommendations }: { recommendations: string[] }) {
  return (
    <Card className="dark:bg-slate-900 dark:border-slate-800">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
        <CardTitle className="text-base font-semibold text-foreground">
          Recommandations IA
        </CardTitle>
      </div>
      <ul className="space-y-2 text-sm text-foreground">
        {recommendations.map((item, index) => (
          <li
            className="flex items-start gap-2 rounded-md border border-border bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
            key={`${index}-${item}`}
          >
            <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
              {index + 1}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card className="border-dashed dark:bg-slate-900 dark:border-slate-800">
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          <Brain className="h-7 w-7" />
        </div>
        <p className="text-lg font-semibold text-foreground">Données insuffisantes</p>
        <p className="max-w-md text-sm text-muted-foreground">{message}</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <Button asChild variant="outline">
            <Link to="/reservations">Voir les réservations</Link>
          </Button>
          <Button asChild>
            <Link to="/reservations">Ajouter une réservation</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}

function PendingHint({ hasStatus, trained }: { hasStatus: boolean; trained: boolean }) {
  return (
    <Card className="dark:bg-slate-900 dark:border-slate-800">
      <div className="flex flex-col gap-2 text-sm text-muted-foreground">
        <p className="text-base font-semibold text-foreground">
          {trained ? "Lancez une prédiction" : "Aucune prédiction encore générée"}
        </p>
        <p>
          {trained
            ? "Cliquez sur \"Lancer la prédiction\" pour générer les prévisions à partir du modèle entraîné."
            : "Cliquez sur \"Réentraîner le modèle\" pour entraîner les modèles à partir des données locales."}
        </p>
        {!hasStatus && (
          <p className="text-xs text-orange-600 dark:text-orange-400">
            Statut du modèle indisponible.
          </p>
        )}
      </div>
    </Card>
  );
}

function LegendDot({ color }: { color: string }) {
  return <span className={`mr-1 inline-block h-2 w-2 rounded-full ${color}`} />;
}

function shortWeekday(isoDate: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate.slice(5);
  return new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "2-digit" }).format(date);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getErrorMessage(caught: unknown) {
  return caught instanceof Error ? caught.message : String(caught);
}
