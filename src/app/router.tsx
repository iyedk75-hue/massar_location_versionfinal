import { createHashRouter } from "react-router-dom";
import { App } from "@/app/App";
import { AIForecastPage } from "@/pages/ai/AIForecastPage";
import { ArchivePage } from "@/pages/archive/ArchivePage";
import { CarsPage } from "@/pages/cars/CarsPage";
import { ClientsPage } from "@/pages/clients/ClientsPage";
import { ContractPreview } from "@/pages/contracts/ContractPreview";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { MouvementPage } from "@/pages/mouvement/MouvementPage";
import { PaymentDetailsPage } from "@/pages/payments/PaymentDetailsPage";
import { PaymentsPage } from "@/pages/payments/PaymentsPage";
import { RapportPage } from "@/pages/rapport/RapportPage";
import { ReservationsPage } from "@/pages/reservations/ReservationsPage";
import { SettingsPage } from "@/pages/settings/SettingsPage";

export const router = createHashRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "cars", element: <CarsPage /> },
      { path: "clients", element: <ClientsPage /> },
      { path: "reservations", element: <ReservationsPage /> },
      { path: "payments", element: <PaymentsPage /> },
      { path: "payments/detail", element: <PaymentDetailsPage /> },
      { path: "payments/:paymentId", element: <PaymentDetailsPage /> },
      { path: "rapport", element: <RapportPage /> },
      { path: "mouvement", element: <MouvementPage /> },
      { path: "ai-forecast", element: <AIForecastPage /> },
      { path: "contracts", element: <ContractPreview /> },
      { path: "archive", element: <ArchivePage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
]);
