import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api-response";
import { getDashboardMetrics } from "@/lib/services/analytics-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthUser(req);
    const metrics = await getDashboardMetrics(user.id);
    return NextResponse.json(metrics);
  } catch (error: unknown) {
    return handleApiError(error, "GET /api/analytics error");
  }
}
