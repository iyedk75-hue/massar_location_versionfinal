import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { RapportRow } from "@/utils/excel";
import { formatMoney } from "@/utils/money";

export interface RapportPdfOptions {
  agencyName?: string;
  period: string;
  rows: RapportRow[];
  totals: { reservations: number; ca: number; encaisse: number; reste: number };
  kpis: { caTotal: number; encaisse: number; reste: number; reservations: number; trend: string | null };
}

const NAVY = rgb(0.05, 0.16, 0.32);
const BLUE = rgb(0.11, 0.31, 0.87);
const GREEN = rgb(0.06, 0.72, 0.51);
const RED = rgb(0.87, 0.2, 0.2);
const GREY = rgb(0.44, 0.52, 0.6);
const LIGHT_GREY = rgb(0.93, 0.95, 0.98);
const WHITE = rgb(1, 1, 1);
const BLACK = rgb(0, 0, 0);

export async function createRapportPdf(options: RapportPdfOptions): Promise<Uint8Array> {
  const { agencyName = "Massar Location", period, rows, totals, kpis } = options;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595;
  const pageHeight = 842;
  const marginX = 40;
  const contentWidth = pageWidth - marginX * 2;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - 48;

  const drawText = (text: string, x: number, yPos: number, size: number, f = font, color = BLACK) => {
    page.drawText(text, { x, y: yPos, size, font: f, color });
  };

  const drawRect = (x: number, yPos: number, w: number, h: number, color: ReturnType<typeof rgb>) => {
    page.drawRectangle({ x, y: yPos, width: w, height: h, color });
  };

  // Header band
  drawRect(0, y - 4, pageWidth, 56, NAVY);
  drawText(agencyName, marginX, y + 26, 16, bold, WHITE);
  drawText("Rapport Chiffre d'Affaires", marginX, y + 10, 11, font, rgb(0.7, 0.8, 0.95));
  drawText(period, pageWidth - marginX - font.widthOfTextAtSize(period, 11), y + 10, 11, font, rgb(0.7, 0.8, 0.95));
  y -= 60;

  // KPI row
  const kpiW = (contentWidth - 9) / 4;
  const kpiLabels = ["CA Total", "Encaisse", "Reste a payer", "Reservations"];
  const kpiValues = [
    formatMoney(kpis.caTotal),
    formatMoney(kpis.encaisse),
    formatMoney(kpis.reste),
    String(kpis.reservations),
  ];
  const kpiColors = [GREEN, BLUE, RED, NAVY];

  kpiLabels.forEach((label, index) => {
    const x = marginX + index * (kpiW + 3);
    drawRect(x, y - 54, kpiW, 58, LIGHT_GREY);
    drawRect(x, y + 4, kpiW, 3, kpiColors[index]);
    drawText(label, x + 6, y - 6, 8, font, GREY);
    drawText(kpiValues[index], x + 6, y - 24, 11, bold, kpiColors[index]);
    if (index === 0 && kpis.trend) {
      drawText(kpis.trend, x + 6, y - 38, 8, font, GREY);
    }
  });

  y -= 70;

  // Taux encaissement bar
  const rate = kpis.caTotal > 0 ? kpis.encaisse / kpis.caTotal : 0;
  drawText("Taux d'encaissement", marginX, y, 9, bold, NAVY);
  y -= 14;
  drawRect(marginX, y - 6, contentWidth, 10, rgb(0.9, 0.93, 0.97));
  drawRect(marginX, y - 6, contentWidth * rate, 10, GREEN);
  drawText(`${Math.round(rate * 100)}%`, marginX + contentWidth * rate + 4, y - 4, 8, bold, GREEN);
  y -= 26;

  // Table header
  const cols = [
    { label: "Date", x: marginX, w: 70 },
    { label: "Reservations", x: marginX + 70, w: 80 },
    { label: "CA (DT)", x: marginX + 150, w: 90 },
    { label: "Encaisse (DT)", x: marginX + 240, w: 90 },
    { label: "Reste (DT)", x: marginX + 330, w: 85 },
    { label: "Tend.", x: marginX + 415, w: 40 },
  ];

  drawRect(marginX, y - 14, contentWidth, 20, NAVY);
  cols.forEach((col) => drawText(col.label, col.x + 4, y - 8, 8, bold, WHITE));
  y -= 22;

  let prevCa = 0;

  for (const row of rows) {
    if (y < 80) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - 48;
    }

    const isEven = rows.indexOf(row) % 2 === 0;
    if (isEven) drawRect(marginX, y - 12, contentWidth, 18, rgb(0.97, 0.98, 1));

    const trend = prevCa > 0 ? (row.ca >= prevCa ? "+" : "-") : "";
    const trendColor = trend === "+" ? GREEN : trend === "-" ? RED : GREY;

    drawText(row.date, cols[0].x + 4, y - 6, 8, font, BLACK);
    drawText(String(row.reservations), cols[1].x + 4, y - 6, 8, font, BLACK);
    drawText(formatMoney(row.ca), cols[2].x + 4, y - 6, 8, font, row.ca > 0 ? GREEN : GREY);
    drawText(formatMoney(row.encaisse), cols[3].x + 4, y - 6, 8, font, NAVY);
    drawText(formatMoney(row.reste), cols[4].x + 4, y - 6, 8, font, row.reste > 0 ? RED : GREY);
    if (trend) drawText(trend === "+" ? "^" : "v", cols[5].x + 4, y - 6, 8, bold, trendColor);

    prevCa = row.ca;
    y -= 18;
  }

  // Totals row
  drawRect(marginX, y - 14, contentWidth, 20, rgb(0.1, 0.2, 0.5));
  drawText("TOTAL", cols[0].x + 4, y - 8, 9, bold, WHITE);
  drawText(String(totals.reservations), cols[1].x + 4, y - 8, 9, bold, WHITE);
  drawText(formatMoney(totals.ca), cols[2].x + 4, y - 8, 9, bold, WHITE);
  drawText(formatMoney(totals.encaisse), cols[3].x + 4, y - 8, 9, bold, WHITE);
  drawText(formatMoney(totals.reste), cols[4].x + 4, y - 8, 9, bold, WHITE);
  y -= 28;

  // Footer
  const generated = `Genere le ${new Date().toLocaleDateString("fr-FR")}`;
  drawText(generated, marginX, 28, 8, font, GREY);
  drawText("Massar Location", pageWidth - marginX - bold.widthOfTextAtSize("Massar Location", 8), 28, 8, bold, NAVY);

  return pdfDoc.save();
}

export function downloadPdfBlob(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
