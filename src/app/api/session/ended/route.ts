import { signOut } from "@/auth";

// Appelée par la DAL quand la session ne correspond plus à un compte actif
// (compte désactivé ou supprimé, base de démo réinitialisée…) : on efface le cookie de session.
export async function GET() {
  await signOut({ redirectTo: "/login" });
}
