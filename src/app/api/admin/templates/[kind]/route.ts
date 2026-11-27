import ExcelJS from "exceljs";
import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/dal";
import { IMPORTERS, isImportKind } from "@/lib/imports";
import { styleSheet, xlsxResponse } from "@/lib/imports/xlsx";

// Modèle Excel d'un import : onglet « Données » (en-têtes + exemple) et onglet « Aide ».
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/admin/templates/[kind]">) {
  await requireRole("ADMIN");
  const { kind } = await ctx.params;
  if (!isImportKind(kind)) return new NextResponse(null, { status: 404 });
  const { columns } = IMPORTERS[kind];

  const workbook = new ExcelJS.Workbook();
  const data = workbook.addWorksheet("Données");
  data.addRow(columns.map((c) => c.headers[0]));
  data.addRow(columns.map((c) => c.example ?? ""));
  styleSheet(data);

  const help = workbook.addWorksheet("Aide");
  help.addRow(["Colonne", "Obligatoire", "Description", "Autres en-têtes acceptés"]);
  for (const c of columns) {
    help.addRow([c.headers[0], c.required ? "oui" : "", c.help, c.headers.slice(1).join(", ")]);
  }
  styleSheet(help);

  return xlsxResponse(workbook, `modele-${kind}.xlsx`);
}
