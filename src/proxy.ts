import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ROLE_HOME, isRole, rolesForPath } from "@/lib/roles";

// Vérification « optimiste » : redirige vite les visiteurs non connectés ou hors de leur espace.
// La vérification qui fait foi est dans src/lib/dal.ts (appelée par chaque layout / action).
export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const role = req.auth?.user?.role;
  const loggedIn = isRole(role);

  if (pathname === "/login") {
    return loggedIn
      ? NextResponse.redirect(new URL(ROLE_HOME[role], req.url))
      : NextResponse.next();
  }

  if (!loggedIn) {
    const login = new URL("/login", req.url);
    if (pathname !== "/") login.searchParams.set("callbackUrl", pathname + search);
    return NextResponse.redirect(login);
  }

  const allowed = rolesForPath(pathname);
  if (pathname === "/" || (allowed && !allowed.includes(role))) {
    return NextResponse.redirect(new URL(ROLE_HOME[role], req.url));
  }

  return NextResponse.next();
});

export const config = {
  // Tout sauf les routes Auth.js, les fichiers statiques et les images.
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|vendor/|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
