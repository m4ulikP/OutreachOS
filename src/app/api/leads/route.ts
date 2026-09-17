import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth/session";
import { handleApiError, ValidationError } from "@/lib/api-response";
import { listLeads, createLead } from "@/lib/services/lead-service";
import { listLeadsQuerySchema, createLeadSchema } from "@/lib/validation/leads";
import { withApiObservability } from "@/lib/api-wrapper";
import { logger } from "@/lib/logger";
import { REQUEST_ID_HEADER } from "@/lib/request-id";

export const dynamic = "force-dynamic";

export const GET = withApiObservability(async (req: NextRequest, _ctx, { requestId }) => {
  try {
    const user = await requireAuthUser(req);
    const { searchParams } = new URL(req.url);

    // Build raw query object from search params
    const rawQuery: Record<string, string> = {};
    for (const [key, value] of searchParams.entries()) {
      if (value !== "") {
        rawQuery[key] = value;
      }
    }

    // Validate query parameters with Zod
    const queryValidation = listLeadsQuerySchema.safeParse(rawQuery);
    if (!queryValidation.success) {
      return handleApiError(queryValidation.error, "Validation error in GET /api/leads", requestId);
    }

    const params = queryValidation.data;

    const result = await listLeads({
      userId: user.id,
      search: params.search,
      stage: params.stage,
      temperature: params.temperature,
      industry: params.industry,
      location: params.location,
      companyName: params.companyName,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
      page: params.page,
      pageSize: params.pageSize,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    return handleApiError(error, "GET /api/leads error", requestId);
  }
});

export const POST = withApiObservability(async (req: NextRequest, _ctx, { requestId }) => {
  try {
    const user = await requireAuthUser(req);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return handleApiError(new ValidationError("Invalid JSON in request body"), undefined, requestId);
    }

    // Strict validation and mass-assignment protection
    const validation = createLeadSchema.safeParse(body);
    if (!validation.success) {
      return handleApiError(validation.error, "Validation error in POST /api/leads", requestId);
    }

    const validatedInput = validation.data;
    const { lead, deduplication } = await createLead(user.id, validatedInput);

    if (deduplication.isDuplicate) {
      logger.warn("Duplicate lead detected during creation", {
        userId: user.id,
        matchedBy: deduplication.matchedBy,
        matchedLeadId: deduplication.matchedLeadId,
        requestId,
      });

      const res = NextResponse.json(
        {
          error: deduplication.reason,
          code: "CONFLICT",
          message: "Duplicate lead detected",
          deduplication,
        },
        { status: 409 }
      );
      res.headers.set(REQUEST_ID_HEADER, requestId);
      return res;
    }

    logger.info("Lead created successfully", {
      userId: user.id,
      leadId: lead?.id,
      requestId,
    });

    const res = NextResponse.json(
      {
        lead,
        deduplication,
      },
      { status: 201 }
    );
    res.headers.set(REQUEST_ID_HEADER, requestId);
    return res;
  } catch (error: unknown) {
    return handleApiError(error, "POST /api/leads error", requestId);
  }
});
