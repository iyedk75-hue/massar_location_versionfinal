export type AITrainingFailureReason = "INSUFFICIENT_DATA" | "PYTHON_NOT_FOUND" | "EXECUTION_ERROR" | "UNKNOWN";

export interface AITrainingResultSuccess {
  success: true;
  trainedAt: string;
  rowsUsed: number;
  clientsUsed: number;
  reservationsUsed: number;
  confidence: number;
  message: string;
}

export interface AITrainingResultFailure {
  success: false;
  reason: AITrainingFailureReason;
  message: string;
}

export type AITrainingResult = AITrainingResultSuccess | AITrainingResultFailure;

export interface AIRevenueForecast {
  next7Days: number;
  next30Days: number;
  trend: string;
}

export interface AIDemandForecast {
  next7DaysReservations: number;
  next30DaysReservations: number;
  peakDays: string[];
}

export interface AITopCar {
  carName: string;
  expectedReservations: number;
  score: number;
}

export interface AIClientSegment {
  name: string;
  count: number;
  description: string;
}

export interface AIDailyPoint {
  date: string;
  value: number;
}

export interface AIForecastResultSuccess {
  success: true;
  generatedAt: string;
  modelConfidence: number;
  dataPeriod: string;
  revenue: AIRevenueForecast;
  demand: AIDemandForecast;
  topCars: AITopCar[];
  clientSegments: AIClientSegment[];
  recommendations: string[];
  revenueHistory?: AIDailyPoint[];
  revenueForecast?: AIDailyPoint[];
  demandForecast?: AIDailyPoint[];
}

export interface AIForecastResultFailure {
  success: false;
  reason: AITrainingFailureReason;
  message: string;
}

export type AIForecastResult = AIForecastResultSuccess | AIForecastResultFailure;

export interface AIModelStatus {
  trained: boolean;
  lastTrainedAt: string | null;
  modelsFound: string[];
  pythonAvailable: boolean;
  pythonPath?: string | null;
  message?: string;
}

export interface AISeedSampleDataResult {
  success: true;
  carsCreated: number;
  clientsCreated: number;
  reservationsCreated: number;
  paymentsCreated: number;
  message: string;
}

export interface AISettings {
  enabled: boolean;
  pythonPath: string;
  autoTrain: boolean;
  minReservations: number;
  modelPath: string;
}

export const defaultAISettings: AISettings = {
  enabled: true,
  pythonPath: "",
  autoTrain: false,
  minReservations: 30,
  modelPath: "ml/models",
};
