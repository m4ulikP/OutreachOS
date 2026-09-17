/**
 * OutreachOS RFC 4180 Pure-TypeScript CSV Parser & Normalizer
 * Zero external runtime dependencies.
 *
 * Implements strict RFC 4180 parsing with support for:
 * - Commas inside quoted fields
 * - Newlines inside quoted fields
 * - Escaped double quotes ("")
 * - CRLF and LF line endings
 * - UTF-8 Byte Order Mark (\uFEFF) stripping
 * - Accurate 1-based original CSV row/line numbering
 * - Bounded production safety limits (5 MB file size, 2,000 data rows)
 */

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_ROW_COUNT = 2000;
export const MAX_FIELD_LENGTH = 10000;

export interface ParsedCsvRow {
  rowNumber: number; // 1-based line number of the start of the row in the CSV
  rawValues: Record<string, string>; // Header -> Raw string value
  mappedValues: Record<string, string>; // Canonical Field -> String value
}

export interface ParseCsvResult {
  success: boolean;
  headers: string[];
  canonicalHeaders: string[];
  rows: ParsedCsvRow[];
  totalRows: number;
  forbiddenHeaders: string[];
  errors: { rowNumber: number; field?: string; message: string }[];
}

/**
 * Canonical fields permitted by the OutreachOS Lead model.
 */
export const CANONICAL_LEAD_FIELDS = [
  "fullName",
  "firstName",
  "lastName",
  "email",
  "jobTitle",
  "companyName",
  "companyDomain",
  "website",
  "linkedInUrl",
  "phone",
  "industry",
  "location",
  "companySize",
  "notes",
  "stage",
  "tagType",
] as const;

export type CanonicalLeadField = (typeof CANONICAL_LEAD_FIELDS)[number];

/**
 * Server-controlled or forbidden columns that must never be injected from untrusted CSV data.
 */
export const FORBIDDEN_HEADERS = [
  "userid",
  "user_id",
  "tenantid",
  "tenant_id",
  "id",
  "leadid",
  "lead_id",
  "createdat",
  "created_at",
  "updatedat",
  "updated_at",
  "lastinteractionat",
  "last_interaction_at",
  "normalizedemail",
  "normalized_email",
  "normalizedlinkedinurl",
  "normalized_linkedin_url",
  "compositehash",
  "composite_hash",
];

/**
 * Normalized alias dictionary for auto-mapping CSV headers to canonical fields.
 */
const FIELD_ALIASES: Record<CanonicalLeadField, string[]> = {
  fullName: [
    "fullname",
    "full name",
    "name",
    "contact name",
    "prospect name",
    "lead name",
    "person name",
  ],
  firstName: ["firstname", "first name", "first", "given name"],
  lastName: ["lastname", "last name", "last", "surname", "family name"],
  email: ["email", "email address", "work email", "contact email", "e-mail", "mail"],
  jobTitle: [
    "jobtitle",
    "job title",
    "title",
    "role",
    "position",
    "designation",
    "job",
  ],
  companyName: [
    "company",
    "company name",
    "company_name",
    "organization",
    "organisation",
    "account",
    "business",
  ],
  companyDomain: ["company domain", "company_domain", "domain", "email domain"],
  website: ["website", "url", "company website", "company url", "web", "site", "homepage"],
  linkedInUrl: [
    "linkedin",
    "linkedin url",
    "linkedin profile",
    "linkedin link",
    "linkedin_url",
    "linkedin_profile",
    "linkedin profile url",
  ],
  phone: [
    "phone",
    "phone number",
    "phone_number",
    "telephone",
    "mobile",
    "cell",
    "direct phone",
  ],
  industry: ["industry", "sector", "vertical", "business domain"],
  location: [
    "location",
    "city",
    "country",
    "region",
    "address",
    "state",
    "geo",
    "headquarters",
  ],
  companySize: [
    "company size",
    "companysize",
    "company_size",
    "size",
    "employees",
    "headcount",
    "employee count",
  ],
  notes: [
    "notes",
    "note",
    "comments",
    "comment",
    "description",
    "details",
    "context",
    "prospect notes",
  ],
  stage: ["stage", "lead stage", "lead_stage", "status", "pipeline stage"],
  tagType: [
    "tag",
    "temperature",
    "tag type",
    "tags",
    "priority",
    "rating",
    "initial temperature",
  ],
};

/**
 * Normalizes a header string for alias lookup:
 * Lowercases, strips punctuation (except spaces), and collapses whitespace.
 */
export function normalizeHeaderString(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Maps a single raw header to a canonical field, or null if unmapped.
 */
export function mapHeaderToCanonical(rawHeader: string): CanonicalLeadField | null {
  const norm = normalizeHeaderString(rawHeader);

  // Check direct match
  for (const field of CANONICAL_LEAD_FIELDS) {
    if (field.toLowerCase() === norm) return field;
  }

  // Check aliases
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.includes(norm)) {
      return field as CanonicalLeadField;
    }
  }

  return null;
}

/**
 * Parses raw CSV text into rows and headers using a state machine parser adhering to RFC 4180.
 */
export function parseCsv(csvText: string): ParseCsvResult {
  const errors: { rowNumber: number; field?: string; message: string }[] = [];

  // 1. Safety Limit: File Size
  if (typeof csvText !== "string") {
    return {
      success: false,
      headers: [],
      canonicalHeaders: [],
      rows: [],
      totalRows: 0,
      forbiddenHeaders: [],
      errors: [{ rowNumber: 1, message: "Invalid CSV content: expected string input." }],
    };
  }

  // Strip UTF-8 Byte Order Mark (BOM) if present
  let text = csvText;
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  if (text.length > MAX_FILE_SIZE_BYTES) {
    return {
      success: false,
      headers: [],
      canonicalHeaders: [],
      rows: [],
      totalRows: 0,
      forbiddenHeaders: [],
      errors: [
        {
          rowNumber: 1,
          message: `CSV file size exceeds the 5 MB limit (received ${(
            text.length /
            (1024 * 1024)
          ).toFixed(2)} MB).`,
        },
      ],
    };
  }

  if (text.trim() === "") {
    return {
      success: false,
      headers: [],
      canonicalHeaders: [],
      rows: [],
      totalRows: 0,
      forbiddenHeaders: [],
      errors: [{ rowNumber: 1, message: "The CSV file is empty." }],
    };
  }

  // 2. RFC 4180 State-Machine Lexer
  // Tokens: fields and line breaks
  const rawRecords: { rowNumber: number; fields: string[] }[] = [];
  let currentRowFields: string[] = [];
  let currentField = "";
  let inQuotes = false;
  let currentRowNumber = 1;
  let recordStartRowNumber = 1;

  const len = text.length;

  for (let i = 0; i < len; i++) {
    const char = text[i];
    const nextChar = i + 1 < len ? text[i + 1] : null;

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped double quote ("")
          currentField += '"';
          i++; // Skip the second quote
        } else {
          // End of quoted string
          inQuotes = false;
        }
      } else {
        if (char === "\n") {
          currentRowNumber++;
        }
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        // Field delimiter
        if (currentField.length > MAX_FIELD_LENGTH) {
          errors.push({
            rowNumber: recordStartRowNumber,
            message: `Field exceeds maximum length of ${MAX_FIELD_LENGTH} characters.`,
          });
        }
        currentRowFields.push(currentField.trim());
        currentField = "";
      } else if (char === "\r") {
        // Windows line ending: \r\n or standalone \r
        if (nextChar === "\n") {
          i++; // Skip \n
        }
        currentRowFields.push(currentField.trim());
        currentField = "";

        // Only emit non-empty rows
        if (currentRowFields.some((f) => f !== "")) {
          rawRecords.push({
            rowNumber: recordStartRowNumber,
            fields: currentRowFields,
          });
        }

        currentRowFields = [];
        currentRowNumber++;
        recordStartRowNumber = currentRowNumber;
      } else if (char === "\n") {
        // Unix line ending
        currentRowFields.push(currentField.trim());
        currentField = "";

        if (currentRowFields.some((f) => f !== "")) {
          rawRecords.push({
            rowNumber: recordStartRowNumber,
            fields: currentRowFields,
          });
        }

        currentRowFields = [];
        currentRowNumber++;
        recordStartRowNumber = currentRowNumber;
      } else {
        currentField += char;
      }
    }
  }

  // Handle unterminated quote error
  if (inQuotes) {
    return {
      success: false,
      headers: [],
      canonicalHeaders: [],
      rows: [],
      totalRows: 0,
      forbiddenHeaders: [],
      errors: [
        {
          rowNumber: recordStartRowNumber,
          message: "Malformed CSV: Unterminated quote detected.",
        },
      ],
    };
  }

  // Push the final field and row if any
  if (currentField !== "" || currentRowFields.length > 0) {
    currentRowFields.push(currentField.trim());
    if (currentRowFields.some((f) => f !== "")) {
      rawRecords.push({
        rowNumber: recordStartRowNumber,
        fields: currentRowFields,
      });
    }
  }

  // 3. Header Validation
  if (rawRecords.length === 0) {
    return {
      success: false,
      headers: [],
      canonicalHeaders: [],
      rows: [],
      totalRows: 0,
      forbiddenHeaders: [],
      errors: [{ rowNumber: 1, message: "No data rows found in CSV." }],
    };
  }

  const headerRecord = rawRecords[0];
  const rawHeaders = headerRecord.fields;

  if (rawHeaders.length === 0 || rawHeaders.every((h) => h === "")) {
    return {
      success: false,
      headers: [],
      canonicalHeaders: [],
      rows: [],
      totalRows: 0,
      forbiddenHeaders: [],
      errors: [{ rowNumber: 1, message: "CSV header row is missing or empty." }],
    };
  }

  // Check for forbidden server-controlled headers
  const forbiddenHeadersFound: string[] = [];
  for (const h of rawHeaders) {
    const norm = h.toLowerCase().trim().replace(/[_-]/g, "");
    if (FORBIDDEN_HEADERS.includes(norm)) {
      forbiddenHeadersFound.push(h);
    }
  }

  // Map headers to canonical fields & check for duplicates/ambiguities
  const canonicalHeaders: string[] = [];
  const headerIndexToCanonical: (CanonicalLeadField | null)[] = [];
  const canonicalToIndicesMap = new Map<CanonicalLeadField, number[]>();

  for (let idx = 0; idx < rawHeaders.length; idx++) {
    const rawH = rawHeaders[idx];
    const canonical = mapHeaderToCanonical(rawH);
    headerIndexToCanonical.push(canonical);

    if (canonical) {
      if (!canonicalHeaders.includes(canonical)) {
        canonicalHeaders.push(canonical);
      }
      const existing = canonicalToIndicesMap.get(canonical) || [];
      existing.push(idx);
      canonicalToIndicesMap.set(canonical, existing);
    }
  }

  // Check for ambiguous duplicate mappings (e.g. both 'Full Name' and 'Name' provided)
  for (const [canonicalField, indices] of canonicalToIndicesMap.entries()) {
    if (indices.length > 1) {
      const offendingHeaders = indices.map((i) => `"${rawHeaders[i]}"`).join(" and ");
      errors.push({
        rowNumber: 1,
        field: canonicalField,
        message: `Ambiguous CSV headers: Columns ${offendingHeaders} both map to canonical field '${canonicalField}'. Please remove one.`,
      });
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      headers: rawHeaders,
      canonicalHeaders,
      rows: [],
      totalRows: 0,
      forbiddenHeaders: forbiddenHeadersFound,
      errors,
    };
  }

  // 4. Data Row Processing & Max Limit Enforcement
  const dataRecords = rawRecords.slice(1);

  if (dataRecords.length > MAX_ROW_COUNT) {
    return {
      success: false,
      headers: rawHeaders,
      canonicalHeaders,
      rows: [],
      totalRows: dataRecords.length,
      forbiddenHeaders: forbiddenHeadersFound,
      errors: [
        {
          rowNumber: MAX_ROW_COUNT + 1,
          message: `CSV row count (${dataRecords.length}) exceeds the maximum allowed limit of ${MAX_ROW_COUNT} rows per import. Please split your file into smaller batches.`,
        },
      ],
    };
  }

  const parsedRows: ParsedCsvRow[] = [];

  for (const record of dataRecords) {
    const rawValues: Record<string, string> = {};
    const mappedValues: Record<string, string> = {};

    for (let idx = 0; idx < rawHeaders.length; idx++) {
      const headerName = rawHeaders[idx];
      const val = idx < record.fields.length ? record.fields[idx] : "";
      rawValues[headerName] = val;

      const canonical = headerIndexToCanonical[idx];
      if (canonical && val !== "") {
        mappedValues[canonical] = val;
      }
    }

    parsedRows.push({
      rowNumber: record.rowNumber,
      rawValues,
      mappedValues,
    });
  }

  return {
    success: true,
    headers: rawHeaders,
    canonicalHeaders,
    rows: parsedRows,
    totalRows: parsedRows.length,
    forbiddenHeaders: forbiddenHeadersFound,
    errors,
  };
}
