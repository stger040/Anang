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
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    appRole?: AppRole;
  }
}
