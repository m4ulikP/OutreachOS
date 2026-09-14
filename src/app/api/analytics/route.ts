import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth/session";
import { getDashboardMetrics } from "@/lib/services/analytics-service";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthUser(req);
    const metrics = await getDashboardMetrics(user.id);
    return NextResponse.json(metrics);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch analytics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
