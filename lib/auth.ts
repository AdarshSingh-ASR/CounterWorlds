import { betterAuth } from "better-auth";
import { admin, organization, twoFactor } from "better-auth/plugins";
import { db } from "./db";

const platformAdmins = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export const auth = betterAuth({
  appName: "CounterWorlds",
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.COUNTERWORLDS_BASE_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET ?? "local-development-secret-change-before-deploying",
  database: db,
  emailAndPassword: { enabled: false },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "missing-google-client-id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "missing-google-client-secret",
    },
  },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  rateLimit: { enabled: true, storage: "database", window: 60, max: 100 },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => ({
          data: { ...user, role: platformAdmins.includes(user.email.toLowerCase()) ? "admin" : "user" },
        }),
      },
    },
  },
  plugins: [
    organization({ allowUserToCreateOrganization: true, organizationLimit: 5, creatorRole: "owner" }),
    admin({ defaultRole: "user", adminRoles: ["admin"], impersonationSessionDuration: 60 * 15 }),
    twoFactor({ issuer: "CounterWorlds", allowPasswordless: true, skipVerificationOnEnable: false }),
  ],
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    cookiePrefix: "counterworlds",
  },
  trustedOrigins: [process.env.BETTER_AUTH_URL, process.env.COUNTERWORLDS_BASE_URL, "http://localhost:3000"]
    .filter((value): value is string => Boolean(value)),
});

export type AuthSession = typeof auth.$Infer.Session;
