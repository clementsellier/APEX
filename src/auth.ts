import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";

const credentialsSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1),
});

class InvalidCredentials extends CredentialsSignin {
  code = "invalid_credentials";
}

// Hash factice : on compare toujours un mot de passe, même si l'e-mail est inconnu,
// pour ne pas révéler par le temps de réponse quels comptes existent.
const DUMMY_HASH = bcrypt.hashSync("dummy-password-never-matches", 10);

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 * 10 }, // 10 h : une journée terrain
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) throw new InvalidCredentials();
        const { email, password } = parsed.data;

        const user = await db.user.findUnique({ where: { email } });
        const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

        if (!user || !user.passwordHash || !ok || user.status !== "ACTIVE") {
          if (user) {
            await db.user.update({
              where: { id: user.id },
              data: { lastLoginAt: new Date(), lastLoginSuccess: false },
            });
          }
          throw new InvalidCredentials();
        }

        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date(), lastLoginSuccess: true },
        });

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          firstName: user.firstName,
          role: user.role,
          locale: user.locale,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.firstName = user.firstName;
        token.locale = user.locale;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as Role;
      session.user.firstName = token.firstName as string;
      session.user.locale = token.locale as "fr" | "en";
      return session;
    },
  },
});
