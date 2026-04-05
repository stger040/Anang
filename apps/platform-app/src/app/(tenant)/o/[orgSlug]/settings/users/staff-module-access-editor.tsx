"use client";

import { StaffModuleCheckboxes } from "@/app/admin/tenants/staff-module-checkboxes";
import {
  updateMembershipStaffModulesAction,
  type UpdateStaffModulesState,
} from "../membership-actions";
import { Button } from "@anang/ui";
import type { ModuleKey } from "@prisma/client";
import { useActionState } from "react";

export function StaffModuleAccessEditor({
  orgSlug,
  membershipId,
  userEmail,
  defaultAllowList,
}: {
  orgSlug: string;
  membershipId: string;
  userEmail: string;
  defaultAllowList: ModuleKey[];
}) {
  const [state, formAction, pending] = useActionState<
    UpdateStaffModulesState,
    FormData
  >(updateMembershipStaffModulesAction, null);

  return (
    <form action={formAction} className="space-y-2 border-t border-slate-100 pt-3">
      <input type="hidden" name="orgSlug" value={orgSlug} />
      <input type="hidden" name="membershipId" value={membershipId} />
      <p className="text-xs font-medium text-slate-700">{userEmail}</p>
      <StaffModuleCheckboxes
        idPrefix={`settings-mem-${membershipId}`}
        defaultSelected={defaultAllowList}
      />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Save module access"}
      </Button>
      {state?.error ? (
        <p className="text-xs text-red-600">{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p className="text-xs text-emerald-700">Saved.</p>
      ) : null}
    </form>
  );
}
