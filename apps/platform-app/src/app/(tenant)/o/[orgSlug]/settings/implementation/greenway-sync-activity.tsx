import { prisma } from "@/lib/prisma";
import { GREENWAY_FHIR_AUDIT_ACTIONS } from "@/lib/connectors/greenway-fhir/audit-actions";

function asMeta(
  raw: unknown,
): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function summarizeMetadata(action: string, meta: Record<string, unknown> | null): string {
  if (!meta) return "—";
  if (action === "integration.greenway_fhir.patient_read_test") {
    const pid = meta.patientLogicalId;
    const st = meta.httpStatus;
    return typeof pid === "string"
      ? `Patient ${pid}${typeof st === "number" ? ` · HTTP ${st}` : ""}`
      : "Test read";
  }
  const pid = meta.patientLogicalId;
  const ok = meta.syncOk;
  if (ok === true) {
    const n = meta.encountersUpserted;
    const aid = meta.anangPatientId;
    const parts = [
      typeof pid === "string" ? pid : null,
      typeof aid === "string" ? `→ ${aid.slice(0, 8)}…` : null,
      typeof n === "number" ? `${n} enc` : null,
    ].filter(Boolean);
    return parts.join(" · ") || "Sync ok";
  }
  if (typeof meta.error === "string") {
    return meta.error.length > 120 ? `${meta.error.slice(0, 120)}…` : meta.error;
  }
  return "Sync";
}

export async function GreenwayFhirSyncActivity({
  tenantId,
}: {
  tenantId: string;
}) {
  const rows = await prisma.auditEvent.findMany({
    where: {
      tenantId,
      action: { in: [...GREENWAY_FHIR_AUDIT_ACTIONS] },
    },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: {
      id: true,
      action: true,
      metadata: true,
      createdAt: true,
    },
  });

  if (rows.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs text-slate-600">
        No Greenway hub or cron sync activity recorded for this tenant yet.
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
        Recent Greenway activity
      </h4>
      <p className="mt-1 text-[11px] text-slate-500">
        From audit log (hub test/sync and secured cron). No clinical payloads stored.
      </p>
      <ul className="mt-2 space-y-2 text-xs text-slate-800">
        {rows.map((r) => {
          const meta = asMeta(r.metadata);
          const label =
            r.action === "integration.greenway_fhir.patient_read_test"
              ? "Test read"
              : r.action === "integration.greenway_fhir.cron_patient_encounter_sync"
                ? "Cron sync"
                : "Hub sync";
          return (
            <li
              key={r.id}
              className="flex flex-col gap-0.5 border-b border-slate-100/90 pb-2 last:border-0 last:pb-0"
            >
              <span className="font-medium text-slate-900">
                {label}{" "}
                <span className="font-normal text-slate-500">
                  · {r.createdAt.toISOString().replace("T", " ").slice(0, 19)} UTC
                </span>
              </span>
              <span className="text-slate-600">
                {summarizeMetadata(r.action, meta)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
