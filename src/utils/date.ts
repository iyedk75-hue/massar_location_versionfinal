import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

function parseDateValue(value?: string | null) {
  if (!value) return null;

  const isoDate = parseISO(value);
  if (Number.isFinite(isoDate.getTime())) return isoDate;

  const date = new Date(value);
  if (Number.isFinite(date.getTime())) return date;

  return null;
}

export function formatDate(value?: string | null) {
  const date = parseDateValue(value);
  if (!date) return "-";
  return format(date, "dd MMM yyyy", { locale: fr });
}

export function formatDateTime(value?: string | null) {
  const date = parseDateValue(value);
  if (!date) return "-";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatPeriod(startDate?: string | null, endDate?: string | null) {
  if (!startDate || !endDate) return "-";
  return `${formatDateTime(startDate)} -> ${formatDateTime(endDate)}`;
}

export function formatShortDateTime(value?: string | null) {
  const date = parseDateValue(value);
  if (!date) return "-";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(date);
}

export function formatShortPeriod(startDate?: string | null, endDate?: string | null) {
  if (!startDate || !endDate) return "-";
  return `${formatShortDateTime(startDate)} -> ${formatShortDateTime(endDate)}`;
}

export function getRentalDays(startDate: string, endDate: string) {
  const start = parseDateValue(startDate);
  const end = parseDateValue(endDate);

  if (!start || !end) return 0;

  const duration = end.getTime() - start.getTime();

  if (!Number.isFinite(duration) || duration <= 0) return 0;

  return Math.max(1, Math.ceil(duration / (24 * 60 * 60 * 1000)));
}

export function getCalendarRentalDays(startDate: string, endDate: string) {
  const start = parseDateValue(startDate);
  const end = parseDateValue(endDate);

  if (!start || !end) return 0;

  const days = differenceInCalendarDays(end, start);
  if (!Number.isFinite(days) || days < 0) return 0;
  return Math.max(1, days + 1);
}

export function formatRentalDuration(startDate: string, endDate: string) {
  const start = parseDateValue(startDate);
  const end = parseDateValue(endDate);

  if (!start || !end) return "-";

  const durationMinutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / (60 * 1000)));
  const days = Math.floor(durationMinutes / (24 * 60));
  const hours = Math.floor((durationMinutes % (24 * 60)) / 60);
  const minutes = durationMinutes % 60;
  const parts: string[] = [];

  if (days > 0) parts.push(`${days} ${days > 1 ? "jours" : "jour"}`);
  if (hours > 0) parts.push(`${hours} ${hours > 1 ? "heures" : "heure"}`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes} min`);

  return parts.join(" ");
}

export function combineDateAndTime(date: string, time: string) {
  if (!date || !time) return "";

  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);

  if (![year, month, day, hour, minute].every(Number.isFinite)) return "";

  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

export function toDateInputValue(value?: string | null) {
  const date = parseDateValue(value);
  if (!date) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function toTimeInputValue(value?: string | null) {
  const date = parseDateValue(value);
  if (!date) return "";

  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function getLocalDateKey(value: string | Date) {
  const date = value instanceof Date ? value : parseDateValue(value);
  if (!date || !Number.isFinite(date.getTime())) return "";

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Time grid utilities
export function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

export function getWeekDays(startDate: Date): Date[] {
  const start = getStartOfWeek(startDate);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(start);
    day.setDate(day.getDate() + i);
    days.push(day);
  }
  return days;
}

export function getHourPosition(hour: number, minute: number = 0): number {
  return (hour * 60 + minute) / 60;
}

export function getReservationTimePosition(
  reservationStart: string,
  dayDate: Date,
): { topPercent: number; heightPercent: number; startTime: string; endTime: string; isOutOfRange: boolean } {
  const resStart = parseDateValue(reservationStart);
  if (!resStart) {
    return {
      endTime: "-",
      heightPercent: 0,
      isOutOfRange: true,
      startTime: "-",
      topPercent: 0,
    };
  }

  const startHour = resStart.getHours();
  const startMinute = resStart.getMinutes();

  // Calculate position relative to 8:00-20:00 window (12 hours)
  const topHour = getHourPosition(startHour, startMinute);
  const topPercent = ((topHour - 8) / 12) * 100; // 8:00 to 20:00 = 12 hours

  // Fixed height for all blocks (1/12 of the 12-hour window)
  const heightPercent = (1 / 12) * 100;

  // Check if reservation is within visible hours (08:00 - 20:00)
  const isOutOfRange = startHour < 8 || startHour >= 20;

  const startTime = `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}`;

  return {
    topPercent: Math.max(0, Math.min(100, topPercent)),
    heightPercent,
    startTime,
    endTime: startTime, // Using same as start for now, can be enhanced
    isOutOfRange,
  };
}

export function generateHourLabels(startHour: number = 8, endHour: number = 20): string[] {
  const labels: string[] = [];
  for (let i = startHour; i <= endHour; i++) {
    labels.push(`${String(i).padStart(2, "0")}:00`);
  }
  return labels;
}
