"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { generateTempPassword, MANAGER_ROLE } from "@/lib/admin-users";
import { Prisma } from "@/generated/prisma/client";
import { Locale, Role, UserStatus } from "@/generated/prisma/enums";

const optionalText = z
  .string()
  .trim()
  .max(100)
  .transform((v) => v || null);

const userSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  role: z.enum(Role),
  status: z.enum(UserStatus),
  locale: z.enum(Locale),
  team: optionalText,
  primaryRegion: optionalText,
  primaryTerritory: optionalText,
  managerId: optionalText,
});

export type UserField = keyof z.infer<typeof userSchema>;

/** Codes d'erreur traduits côté client (Admin.users.errors.*). */
export type UserError =
  | "required"
  | "invalidEmail"
  | "emailTaken"
  | "territoryRequired"
  | "managerRequired"
  | "managerInvalid"
  | "selfRole"
  | "selfStatus"
  | "hasActiveReports"
  | "failed";

export type UserFormState =
  | {
      ok?: false;
      errors?: Partial<Record<UserField | "form", UserError>>;
      values?: Record<string, string>;
    }
  | { ok: true; userId: string; tempPassword?: string };

function parseForm(formData: FormData) {
  const raw = Object.fromEntries(
    Object.keys(userSchema.shape).map((k) => [k, String(formData.get(k) ?? "")]),
  );
  const parsed = userSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Partial<Record<UserField, UserError>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as UserField;
      errors[field] ??= field === "email" ? "invalidEmail" : "required";
    }
    return { raw, errors } as const;
  }
  return { raw, data: parsed.data } as const;
}

/** Règles métier communes à la création et à la modification. */
async function checkRules(
  data: z.infer<typeof userSchema>,
  userId: string | null,
  adminId: string,
): Promise<Partial<Record<UserField | "form", UserError>>> {
  const errors: Partial<Record<UserField | "form", UserError>> = {};

  if (data.role === "FIELD_USER" && !data.primaryTerritory)
    errors.primaryTerritory = "territoryRequired";

  // Le manager doit avoir le rôle attendu pour ce profil, et être actif.
  const expected = MANAGER_ROLE[data.role];
  if (expected === null) {
    data.managerId = null;
  } else if (!data.managerId) {
    errors.managerId = "managerRequired";
  } else {
    const manager = await db.user.findFirst({
      where: { id: data.managerId, role: expected, status: "ACTIVE", NOT: { id: userId ?? "" } },
      select: { id: true },
    });
    if (!manager) errors.managerId = "managerInvalid";
  }

  if (userId) {
    // L'administrateur ne peut pas se retirer ses propres droits.
    if (userId === adminId && data.role !== "ADMIN") errors.role = "selfRole";
    if (userId === adminId && data.status !== "ACTIVE") errors.status = "selfStatus";

    // Un manager qui encadre encore des personnes actives ne peut pas être désactivé
    // ni changer de rôle : il faut d'abord les rattacher à quelqu'un d'autre.
    const current = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
    const leavesRole = current && current.role !== data.role;
    if (data.status === "INACTIVE" || leavesRole) {
      const reports = await db.user.count({ where: { managerId: userId, status: "ACTIVE" } });
      if (reports > 0) errors[data.status === "INACTIVE" ? "status" : "role"] = "hasActiveReports";
    }
  }
  return errors;
}

function isUniqueViolation(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

export async function createUser(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  const admin = await requireRole("ADMIN");
  const parsed = parseForm(formData);
  if (!parsed.data) return { errors: parsed.errors, values: parsed.raw };

  const errors = await checkRules(parsed.data, null, admin.id);
  if (Object.keys(errors).length) return { errors, values: parsed.raw };

  const tempPassword = generateTempPassword();
  try {
    const user = await db.user.create({
      data: { ...parsed.data, passwordHash: await bcrypt.hash(tempPassword, 10) },
      select: { id: true },
    });
    revalidatePath("/admin", "layout");
    return { ok: true, userId: user.id, tempPassword };
  } catch (e) {
    return {
      errors: isUniqueViolation(e) ? { email: "emailTaken" } : { form: "failed" },
      values: parsed.raw,
    };
  }
}

export async function updateUser(
  userId: string,
  _prev: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  const admin = await requireRole("ADMIN");
  const parsed = parseForm(formData);
  if (!parsed.data) return { errors: parsed.errors, values: parsed.raw };

  const errors = await checkRules(parsed.data, userId, admin.id);
  if (Object.keys(errors).length) return { errors, values: parsed.raw };

  try {
    await db.user.update({ where: { id: userId }, data: parsed.data });
    revalidatePath("/admin", "layout");
    return { ok: true, userId };
  } catch (e) {
    return {
      errors: isUniqueViolation(e) ? { email: "emailTaken" } : { form: "failed" },
      values: parsed.raw,
    };
  }
}

/** Génère un nouveau mot de passe provisoire (affiché une seule fois à l'administrateur). */
export async function resetPassword(userId: string): Promise<{ tempPassword?: string }> {
  await requireRole("ADMIN");
  const tempPassword = generateTempPassword();
  try {
    await db.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(tempPassword, 10) },
    });
    return { tempPassword };
  } catch {
    return {};
  }
}
