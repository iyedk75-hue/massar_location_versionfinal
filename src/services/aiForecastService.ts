import { invokeCommand } from "@/services/invoke";
import type {
  AIForecastResult,
  AIModelStatus,
  AISeedSampleDataResult,
  AISettings,
  AITrainingResult,
} from "@/types/aiForecast";
import { defaultAISettings } from "@/types/aiForecast";

const aiSettingsStorageKey = "rentaldesk:ai-settings";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function readAISettings(): AISettings {
  if (typeof window === "undefined") return defaultAISettings;
  try {
    const stored = window.localStorage.getItem(aiSettingsStorageKey);
    if (!stored) return defaultAISettings;
    return { ...defaultAISettings, ...(JSON.parse(stored) as Partial<AISettings>) };
  } catch {
    return defaultAISettings;
  }
}

export function loadAISettings(): AISettings {
  return readAISettings();
}

export function saveAISettings(settings: AISettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(aiSettingsStorageKey, JSON.stringify(settings));
}

export async function trainAIModels(): Promise<AITrainingResult> {
  const settings = readAISettings();
  if (isTauri()) {
    return invokeCommand<AITrainingResult>("train_ai_models", {
      pythonPath: settings.pythonPath || null,
      modelPath: settings.modelPath || "ml/models",
      minReservations: settings.minReservations,
    });
  }
  return mockTrainingResult();
}

export async function runAIForecast(): Promise<AIForecastResult> {
  const settings = readAISettings();
  if (isTauri()) {
    return invokeCommand<AIForecastResult>("run_ai_forecast", {
      pythonPath: settings.pythonPath || null,
      modelPath: settings.modelPath || "ml/models",
    });
  }
  return mockForecastResult();
}

export async function getAIModelStatus(): Promise<AIModelStatus> {
  const settings = readAISettings();
  if (isTauri()) {
    return invokeCommand<AIModelStatus>("get_ai_model_status", {
      pythonPath: settings.pythonPath || null,
      modelPath: settings.modelPath || "ml/models",
    });
  }
  return mockStatus();
}

export async function seedAISampleData(): Promise<AISeedSampleDataResult> {
  return invokeCommand<AISeedSampleDataResult>("seed_ai_sample_data");
}

function mockTrainingResult(): AITrainingResult {
  const reservations = readMockCollection("reservations");
  const clients = readMockCollection("clients");
  const payments = readMockCollection("payments");

  if (reservations.length < 30) {
    return {
      success: false,
      reason: "INSUFFICIENT_DATA",
      message: "Pas assez de données pour entraîner un modèle fiable.",
    };
  }

  const trainedAt = new Date().toISOString();
  window.localStorage.setItem(
    "rentaldesk:ai-mock-trained-at",
    trainedAt,
  );

  return {
    success: true,
    trainedAt,
    rowsUsed: reservations.length + payments.length,
    clientsUsed: clients.length,
    reservationsUsed: reservations.length,
    confidence: 0.78,
    message: "Modèles entraînés avec succès (mode démo).",
  };
}

function mockForecastResult(): AIForecastResult {
  const reservations = readMockCollection("reservations");
  if (reservations.length < 30) {
    return {
      success: false,
      reason: "INSUFFICIENT_DATA",
      message: "Pas assez de données pour générer une prédiction fiable.",
    };
  }

  const generatedAt = new Date().toISOString();
  const days7 = generateMockDailyPoints(7, 120, 280);
  const days30 = generateMockDailyPoints(30, 90, 320);
  const total7 = days7.reduce((sum, point) => sum + point.value, 0);
  const total30 = days30.reduce((sum, point) => sum + point.value, 0);

  return {
    success: true,
    generatedAt,
    modelConfidence: 0.78,
    dataPeriod: "6 derniers mois",
    revenue: {
      next7Days: Math.round(total7),
      next30Days: Math.round(total30),
      trend: "+9%",
    },
    demand: {
      next7DaysReservations: 8,
      next30DaysReservations: 22,
      peakDays: ["Vendredi", "Samedi", "Dimanche"],
    },
    topCars: [
      { carName: "Toyota Yaris", expectedReservations: 9, score: 0.91 },
      { carName: "Hyundai i20", expectedReservations: 6, score: 0.84 },
      { carName: "Renault Clio", expectedReservations: 5, score: 0.76 },
    ],
    clientSegments: [
      { name: "Clients fidèles", count: 12, description: "Clients réguliers avec plusieurs locations" },
      { name: "Clients occasionnels", count: 18, description: "Clients avec peu de locations" },
      { name: "Clients à forte valeur", count: 6, description: "Clients avec un panier moyen élevé" },
      { name: "Clients inactifs", count: 4, description: "Clients sans location récente" },
    ],
    recommendations: [
      "Préparer plus de véhicules économiques pour le week-end.",
      "Relancer les clients inactifs avec une promotion ciblée.",
      "Surveiller la disponibilité de la Toyota Yaris.",
    ],
    revenueHistory: generateMockDailyPoints(30, 80, 280, true),
    revenueForecast: days7,
    demandForecast: generateMockDailyPoints(7, 1, 4),
  };
}

function mockStatus(): AIModelStatus {
  const trainedAt = window.localStorage.getItem("rentaldesk:ai-mock-trained-at");
  return {
    trained: Boolean(trainedAt),
    lastTrainedAt: trainedAt,
    modelsFound: trainedAt
      ? ["revenue_model.pkl", "demand_model.pkl", "client_segments.pkl"]
      : [],
    pythonAvailable: false,
    pythonPath: null,
    message: "Mode navigateur : Python n'est pas exécuté en dehors de Tauri.",
  };
}

type CollectionName = "cars" | "clients" | "reservations" | "payments";

function readMockCollection(collection: CollectionName): Record<string, unknown>[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(`rentaldesk:${collection}`);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [];
  } catch {
    return [];
  }
}

function generateMockDailyPoints(days: number, min: number, max: number, past = false) {
  const points = [];
  const now = new Date();
  for (let index = 0; index < days; index += 1) {
    const date = new Date(now);
    date.setDate(now.getDate() + (past ? -(days - index) : index));
    const value = min + Math.random() * (max - min);
    points.push({ date: date.toISOString().slice(0, 10), value: Math.round(value) });
  }
  return points;
}
