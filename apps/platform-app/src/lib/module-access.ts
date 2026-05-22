import type { ModuleKey } from "@prisma/client";

export type EffectiveModuleList = ReadonlySet<ModuleKey> | readonly ModuleKey[];

export function hasEffectiveModule(
  effectiveModules: EffectiveModuleList,
  module: ModuleKey,
) {
  return effectiveModules instanceof Set
    ? effectiveModules.has(module)
    : effectiveModules.includes(module);
}
