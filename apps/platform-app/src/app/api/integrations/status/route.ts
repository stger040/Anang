import { getIntegrationStatus } from "@/lib/integration-status";
import { NextResponse } from "next/server";

/** Tenant-agnostic capability snapshot — for ops, scripting, or future admin dashboards. */
export function GET() {
  return NextResponse.json(getIntegrationStatus());
}
