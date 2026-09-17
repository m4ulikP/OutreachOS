import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api-response";
import { getDashboardMetrics } from "@/lib/services/analytics-service";
import { withApiObservability } from "@/lib/api-wrapper";

export const dynamic = "force-dynamic";

export const GET = withApiObservability(async (req: NextRequest, _ctx, { requestId }) => {
  try {
    const user = await requireAuthUser(req);
    const metrics = await getDashboardMetrics(user.id);
    return NextResponse.json(metrics);
  } catch (error: unknown) {
    return handleApiError(error, "GET /api/analytics error", requestId);
  }
});
