import { ModuleKey } from "@prisma/client";

/**
 * Pay can reference Connect workflow context only when the same staff session is
 * allowed to use Connect. Otherwise PA case identifiers/statuses leak across a
 * module boundary even though Connect detail routes are protected.
 */
export function canShowStatementPriorAuthLinks(
  effectiveModules: ReadonlySet<ModuleKey>,
): boolean {
  return effectiveModules.has(ModuleKey.CONNECT);
}
