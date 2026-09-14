import { NextResponse } from "next/server";
import { checkDatabaseConnection } from "@/lib/db";
import { getLeadSourceProvider } from "@/lib/providers/lead-source";
import { getAIProvider } from "@/lib/providers/ai";

export async function GET() {
  const dbStatus = await checkDatabaseConnection();
  const leadSource = getLeadSourceProvider();
  const aiProvider = getAIProvider();

  return NextResponse.json({
    status: "ok",
    database: {
      connected: dbStatus.connected,
      error: dbStatus.error || null,
    },
    providers: {
      leadSource: {
        name: leadSource.name,
        isConfigured: leadSource.isConfigured(),
      },
      ai: {
        name: aiProvider.name,
        isConfigured: aiProvider.isConfigured(),
      },
    },
    timestamp: new Date().toISOString(),
  });
}
