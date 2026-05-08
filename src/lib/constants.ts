import {
  ArrowLeftRight,
  Archive,
  BarChart3,
  Banknote,
  Brain,
  CalendarDays,
  Car,
  FileText,
  Gauge,
  LayoutDashboard,
  UserRound,
} from "lucide-react";

export const navigationItems = [
  { label: "Tableau de bord", path: "/", icon: LayoutDashboard },
  { label: "Voitures", path: "/cars", icon: Car },
  { label: "Clients", path: "/clients", icon: UserRound },
  { label: "Réservations", path: "/reservations", icon: CalendarDays },
  { label: "Paiements", path: "/payments", icon: Banknote },
  { label: "Rapport CA", path: "/rapport", icon: BarChart3 },
  { label: "Mouvement", path: "/mouvement", icon: ArrowLeftRight },
  { label: "Autre", path: "/ai-forecast", icon: Brain },
  { label: "Contrats", path: "/contracts", icon: FileText },
  { label: "Archive", path: "/archive", icon: Archive },
];

export const appName = "Massar Location";

export const dashboardCards = [
  { label: "Total voitures", valueKey: "totalCars", icon: Car },
  { label: "Disponibles", valueKey: "availableCars", icon: Gauge },
  { label: "Louées", valueKey: "rentedCars", icon: CalendarDays },
  { label: "Revenus mois", valueKey: "monthlyRevenue", icon: Banknote },
] as const;
