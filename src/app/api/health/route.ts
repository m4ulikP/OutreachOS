import { NextRequest, NextResponse } from "next/server";
import { checkDatabaseConnection } from "@/lib/db";
import { getLeadSourceProvider } from "@/lib/providers/lead-source";
import { getAIProvider } from "@/lib/providers/ai";
import { getEmailProvider } from "@/lib/email";
import { withApiObservability } from "@/lib/api-wrapper";

export const dynamic = "force-dynamic";

export const GET = withApiObservability(async (_req: NextRequest) => {
  const dbStatus = await checkDatabaseConnection();
  const leadSource = getLeadSourceProvider();
  const aiProvider = getAIProvider();
  const emailProvider = getEmailProvider();

  const isAiConfigured = aiProvider.isConfigured();
  const isProspectProviderConfigured = leadSource.isConfigured();
  const isEmailConfigured = emailProvider.isConfigured;

  const isHealthy = dbStatus.connected;
  const httpStatus = isHealthy ? 200 : 503;

  return NextResponse.json(
    {
      status: isHealthy ? "ok" : "degraded",
      database: {
        connected: dbStatus.connected,
        latencyMs: dbStatus.latencyMs,
        error: dbStatus.error || null,
      },
      aiConfigured: isAiConfigured,
      prospectProviderConfigured: isProspectProviderConfigured,
      emailConfigured: isEmailConfigured,
      providers: {
        leadSource: {
          name: leadSource.name,
          isConfigured: isProspectProviderConfigured,
          isDevelopmentMock: Boolean((leadSource as any).id === "mock"),
        },
        ai: {
          name: aiProvider.name,
          provider: aiProvider.name,
          isConfigured: isAiConfigured,
        },
        email: {
          name: emailProvider.name,
          isConfigured: isEmailConfigured,
        },
      },
      timestamp: new Date().toISOString(),
    },
    { status: httpStatus }
  );
});
