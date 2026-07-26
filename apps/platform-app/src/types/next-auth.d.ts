import type { AppRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    appRole?: AppRole;
  }
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      appRole: AppRole;
      email: string;
      /** True when the session was issued via the credentials (password) provider. */
      authViaCredentials?: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    appRole?: AppRole;
    /** True when the session was issued via the credentials (password) provider. */
    authViaCredentials?: boolean;
  }
}
