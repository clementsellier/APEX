import "server-only";
import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

/** Réponse de téléchargement d'un classeur Excel. */
export async function xlsxResponse(workbook: ExcelJS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Mise en forme commune : en-tête en gras sur fond gris, colonnes ajustées, en-tête figé. */
export function styleSheet(sheet: ExcelJS.Worksheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEDED" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.columns.forEach((col) => {
    let width = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      width = Math.max(width, String(cell.value ?? "").length + 2);
    });
    col.width = Math.min(width, 50);
  });
}
