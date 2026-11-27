import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

// Contours de toutes les UGA (≈ 750 Ko), chargés à la demande par la vue « France » des cartes.
// Réservé aux utilisateurs connectés ; mis en cache par le navigateur pendant une heure.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse(null, { status: 401 });

  const bricks = await db.brick.findMany({
    where: { NOT: { shape: { equals: Prisma.AnyNull } } },
    select: { code: true, territory: true, shape: true },
    orderBy: { code: "asc" },
  });
  return NextResponse.json(
    { zones: bricks.map((b) => ({ code: b.code, sector: b.territory, geometry: b.shape })) },
    { headers: { "Cache-Control": "private, max-age=3600" } },
  );
}
