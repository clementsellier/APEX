import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { ROLE_HOME } from "@/lib/roles";

// "/" n'a pas de contenu propre : chacun est envoyé vers son espace.
// (Le proxy le fait déjà ; ceci est le filet de sécurité côté serveur.)
export default function Root() {
  return (
    <Suspense>
      <RedirectToHome />
    </Suspense>
  );
}

async function RedirectToHome(): Promise<null> {
  const user = await getCurrentUser();
  redirect(ROLE_HOME[user.role]);
}
