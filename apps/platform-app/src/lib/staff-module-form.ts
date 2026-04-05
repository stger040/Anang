import { ModuleKey } from "@prisma/client";

const VALID = new Set<string>(Object.values(ModuleKey));

/** Parse `staffModule` repeated fields from admin invite / add-member forms. */
export function parseStaffModuleKeysFromForm(formData: FormData): ModuleKey[] {
  const keys = new Set<ModuleKey>();
  for (const v of formData.getAll("staffModule")) {
    const s = String(v).trim();
    if (VALID.has(s)) keys.add(s as ModuleKey);
  }
  return [...keys];
}
