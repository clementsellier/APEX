"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { db } from "@/lib/db";
import { ROLE_HOME, rolesForPath } from "@/lib/roles";
import { LOCALE_COOKIE } from "@/i18n/config";

export type LoginState = { error?: "invalid" } | undefined;

/** N'accepte qu'un chemin interne (évite les redirections ouvertes vers un autre site). */
function safeCallback(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) return { error: "invalid" };
    throw error;
  }

  const user = await db.user.findUnique({ where: { email }, select: { role: true, locale: true } });
  if (!user) return { error: "invalid" };

  // L'interface passe dans la langue enregistrée sur le profil.
  (await cookies()).set(LOCALE_COOKIE, user.locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  // On ne suit le callbackUrl que s'il mène à un espace autorisé pour ce rôle.
  const callback = safeCallback(formData.get("callbackUrl"));
  const allowed = callback ? rolesForPath(callback.split("?")[0]) : null;
  const target = callback && allowed?.includes(user.role) ? callback : ROLE_HOME[user.role];
  redirect(target);
}
