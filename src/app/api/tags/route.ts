import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth/session";
import { handleApiError, ValidationError } from "@/lib/api-response";
import { listTags, createTag } from "@/lib/services/lead-service";
import { createTagSchema } from "@/lib/validation/tags";
import { withApiObservability } from "@/lib/api-wrapper";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export const GET = withApiObservability(async (req: NextRequest, _ctx, { requestId }) => {
  try {
    const user = await requireAuthUser(req);
    const tags = await listTags(user.id);
    return NextResponse.json({ tags });
  } catch (error: unknown) {
    return handleApiError(error, "GET /api/tags error", requestId);
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

    const validation = createTagSchema.safeParse(body);
    if (!validation.success) {
      return handleApiError(validation.error, "Validation error in POST /api/tags", requestId);
    }

    const tag = await createTag(user.id, validation.data);

    logger.info("Tag created successfully", {
      userId: user.id,
      tagId: tag.id,
      tagName: tag.name,
      requestId,
    });

    return NextResponse.json({ tag }, { status: 201 });
  } catch (error: unknown) {
    return handleApiError(error, "POST /api/tags error", requestId);
  }
});
