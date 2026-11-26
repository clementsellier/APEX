"use server";

import { cookies } from "next/headers";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isLocale, LOCALE_COOKIE } from "./config";

export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  // Utilisateur connecté : on retient son choix sur son profil.
  const session = await auth();
  if (session?.user?.id) {
    await db.user.update({ where: { id: session.user.id }, data: { locale } });
  }
}
