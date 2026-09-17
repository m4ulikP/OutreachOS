import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth/session";
import { handleApiError, ValidationError } from "@/lib/api-response";
import { withApiObservability } from "@/lib/api-wrapper";
import { processCsvImport } from "@/lib/services/import-service";
import { MAX_FILE_SIZE_BYTES } from "@/lib/csv/parser";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export const POST = withApiObservability(
  async (req: NextRequest, _ctx, { requestId }) => {
    try {
      // 1. Tenant Authentication & Authorization
      const user = await requireAuthUser(req);

      const { searchParams } = new URL(req.url);
      let isPreview = searchParams.get("preview") === "true";
      let csvContent = "";

      const contentType = req.headers.get("content-type") || "";

      // 2. Parse Upload (Primary: multipart/form-data; Secondary: JSON/text fallback)
      if (contentType.includes("multipart/form-data")) {
        const formData = await req.formData();
        const file = formData.get("file");

        if (!file || typeof file === "string") {
          return NextResponse.json(
            {
              error: "VALIDATION_ERROR",
              code: "VALIDATION_ERROR",
              message: "A valid CSV file must be provided under the 'file' field in multipart form data.",
              requestId,
            },
            { status: 400 }
          );
        }

        const fileBlob = file as Blob;
        if (fileBlob.size > MAX_FILE_SIZE_BYTES) {
          return NextResponse.json(
            {
              error: "VALIDATION_ERROR",
              code: "VALIDATION_ERROR",
              message: `Uploaded file size (${(fileBlob.size / (1024 * 1024)).toFixed(
                2
              )} MB) exceeds the maximum allowed limit of 5 MB.`,
              requestId,
            },
            { status: 400 }
          );
        }

        csvContent = await fileBlob.text();

        if (formData.get("preview") === "true") {
          isPreview = true;
        }
      } else if (contentType.includes("application/json")) {
        const jsonBody = await req.json().catch(() => ({}));
        csvContent = jsonBody.csvContent || "";
        if (jsonBody.preview !== undefined) {
          isPreview = Boolean(jsonBody.preview);
        }
      } else if (contentType.includes("text/csv") || contentType.includes("text/plain")) {
        csvContent = await req.text();
      } else {
        return NextResponse.json(
          {
            error: "VALIDATION_ERROR",
            code: "VALIDATION_ERROR",
            message: "Unsupported Content-Type. Please use multipart/form-data with a CSV file.",
            requestId,
          },
          { status: 400 }
        );
      }

      if (!csvContent || csvContent.trim() === "") {
        return NextResponse.json(
          {
            error: "VALIDATION_ERROR",
            code: "VALIDATION_ERROR",
            message: "CSV file is empty. Please provide a CSV file containing headers and prospect rows.",
            requestId,
          },
          { status: 400 }
        );
      }

      // 3. Execute Import Service
      const result = await processCsvImport(user.id, csvContent, {
        preview: isPreview,
      });

      // 4. Observability Logging (Zero sensitive PII logged)
      logger.info("CSV import operation completed", {
        requestId,
        userId: user.id,
        preview: isPreview,
        success: result.success,
        totalProcessed: result.totalProcessed,
        created: result.created,
        readyToImport: result.readyToImport,
        duplicatesSkipped: result.duplicatesSkipped,
        invalidRows: result.invalidRows,
        batchCount: result.batchCount,
        errorCount: result.errors.length,
      });

      if (!result.success) {
        return NextResponse.json(
          {
            error: "CSV_IMPORT_ERROR",
            code: "VALIDATION_ERROR",
            message:
              result.errors[0]?.message ||
              "CSV import failed validation or exceeded safety constraints.",
            summary: result,
            requestId,
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          ...result,
          requestId,
        },
        { status: isPreview ? 200 : 201 }
      );
    } catch (error: unknown) {
      return handleApiError(error, "POST /api/leads/import error", requestId);
    }
  }
);
