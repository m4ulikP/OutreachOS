import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth/session";
import { listLeads, createLead } from "@/lib/services/lead-service";
import { LeadStage, TagType } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthUser(req);
    const { searchParams } = new URL(req.url);

    const search = searchParams.get("search") || undefined;
    const stage = (searchParams.get("stage") as LeadStage) || undefined;
    const temperature = (searchParams.get("temperature") as TagType) || undefined;
    const industry = searchParams.get("industry") || undefined;
    const location = searchParams.get("location") || undefined;
    const companyName = searchParams.get("companyName") || undefined;
    const sortBy = (searchParams.get("sortBy") as "name" | "createdAt" | "lastInteractionAt" | "stage") || "createdAt";
    const sortOrder = (searchParams.get("sortOrder") as "asc" | "desc") || "desc";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);

    const result = await listLeads({
      userId: user.id,
      search,
      stage,
      temperature,
      industry,
      location,
      companyName,
      sortBy,
      sortOrder,
      page,
      pageSize,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve leads";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthUser(req);
    const body = await req.json();

    const { lead, deduplication } = await createLead(user.id, body);

    if (deduplication.isDuplicate) {
      return NextResponse.json(
        {
          error: "Duplicate lead detected",
          deduplication,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        lead,
        deduplication,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create lead";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
