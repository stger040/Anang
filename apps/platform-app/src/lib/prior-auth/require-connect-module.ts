import { ModuleKey } from "@prisma/client";

export function requireConnectModule(
  effectiveModules: ReadonlySet<ModuleKey>,
): void {
  if (!effectiveModules.has(ModuleKey.CONNECT)) {
    throw new Error("Forbidden");
  }
}
