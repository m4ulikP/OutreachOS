import { validateUrlProtocolAndHost, resolveAndValidateHost } from "./ssrf-filter";

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxRedirects?: number;
  maxSizeBytes?: number;
  customResolver?: (host: string) => Promise<string[]>;
  customFetch?: typeof fetch;
  fetchFn?: typeof fetch;
}

export interface RedirectStep {
  from: string;
  to: string;
  status: number;
}

export interface SafeFetchResult {
  requestedUrl: string;
  finalUrl: string;
  statusCode: number;
  redirectChain: RedirectStep[];
  html: string;
  headers: Record<string, string>;
  isFinalHttps: boolean;
  durationMs: number;
}

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_REDIRECTS = 3;
const DEFAULT_MAX_SIZE_BYTES = 1.5 * 1024 * 1024; // 1.5 MB

const PERMITTED_CONTENT_TYPES = [
  "text/html",
  "application/xhtml+xml",
  "text/plain",
];

const FORBIDDEN_CONTENT_TYPES = [
  "application/pdf",
  "application/octet-stream",
  "application/zip",
  "application/x-tar",
  "application/gzip",
  "image/",
  "audio/",
  "video/",
];

/**
 * Executes an SSRF-safe, bounded HTTP fetch against a target website.
 * Enforces pre-connection DNS validation, redirect checking, size limits,
 * content-type inspection, and strict timeouts.
 */
export async function safeFetchWebsite(
  rawUrl: string,
  options: SafeFetchOptions = {}
): Promise<SafeFetchResult> {
  const startTime = Date.now();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const maxSizeBytes = options.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;
  const fetchFn = options.customFetch ?? options.fetchFn ?? fetch;

  let currentUrl = rawUrl.trim();
  const redirectChain: RedirectStep[] = [];
  let redirectCount = 0;

  while (redirectCount <= maxRedirects) {
    // 1. Validate URL protocol and hostname format
    const urlValidation = validateUrlProtocolAndHost(currentUrl);
    if (!urlValidation.valid || !urlValidation.parsedUrl) {
      throw new Error(`SSRF Blocked: ${urlValidation.error}`);
    }

    const parsedUrl = urlValidation.parsedUrl;

    // 2. DNS Resolution & IP validation (blocks private/loopback/cloud metadata)
    const dnsValidation = await resolveAndValidateHost(
      parsedUrl.hostname,
      options.customResolver
    );
    if (!dnsValidation.safe) {
      throw new Error(dnsValidation.error || "DNS resolution failed or resolved to forbidden IP.");
    }

    // 3. Set up AbortController with bounded timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort(new Error(`Website request timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    let response: Response;
    try {
      response = await fetchFn(currentUrl, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 OutreachOS-Research/1.0",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "manual", // Handle redirects explicitly to re-verify SSRF for each hop
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof Error && (err.name === "AbortError" || err.message.includes("timed out"))) {
        throw new Error(`Website request timed out after ${timeoutMs}ms.`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    // 4. Handle HTTP Redirects (301, 302, 303, 307, 308)
    const status = response.status;
    if ([301, 302, 303, 307, 308].includes(status)) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error(`HTTP redirect ${status} received without Location header.`);
      }

      const nextUrl = new URL(location, currentUrl).toString();
      redirectChain.push({ from: currentUrl, to: nextUrl, status });
      redirectCount++;

      if (redirectCount > maxRedirects) {
        throw new Error(`Maximum redirect limit of ${maxRedirects} exceeded.`);
      }

      currentUrl = nextUrl;
      continue; // Re-run loop with next URL (which will be validated against SSRF)
    }

    // 5. Content-Type inspection
    const rawContentType = response.headers.get("content-type") || "";
    const contentType = rawContentType.toLowerCase();

    for (const forbidden of FORBIDDEN_CONTENT_TYPES) {
      if (contentType.includes(forbidden)) {
        throw new Error(
          `Unsupported Content-Type '${rawContentType}'. Binary, document, or media downloads are blocked.`
        );
      }
    }

    const isPermitted = PERMITTED_CONTENT_TYPES.some((p) => contentType.includes(p));
    if (!isPermitted && !contentType.includes("html") && !contentType.includes("text")) {
      throw new Error(
        `Unsupported Content-Type '${rawContentType}'. Only web pages and HTML content are supported.`
      );
    }

    // 6. Content-Length check
    const contentLengthHeader = response.headers.get("content-length");
    if (contentLengthHeader) {
      const contentLength = parseInt(contentLengthHeader, 10);
      if (!isNaN(contentLength) && contentLength > maxSizeBytes) {
        throw new Error(
          `Page size exceeds the maximum limit of ${(maxSizeBytes / (1024 * 1024)).toFixed(1)}MB.`
        );
      }
    }

    // 7. Bounded Body Reading
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > maxSizeBytes) {
      throw new Error(
        `Page content exceeded the maximum size limit of ${(maxSizeBytes / (1024 * 1024)).toFixed(1)}MB.`
      );
    }

    const headersRecord: Record<string, string> = {};
    response.headers.forEach((val, key) => {
      headersRecord[key.toLowerCase()] = val;
    });

    const isFinalHttps = currentUrl.toLowerCase().startsWith("https://");
    const durationMs = Date.now() - startTime;

    return {
      requestedUrl: rawUrl,
      finalUrl: currentUrl,
      statusCode: status,
      redirectChain,
      html: text,
      headers: headersRecord,
      isFinalHttps,
      durationMs,
    };
  }

  throw new Error(`Maximum redirect limit of ${maxRedirects} exceeded.`);
}
