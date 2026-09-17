# OutreachOS — Production Deployment Runbook & Release Guide

This document outlines the production deployment procedure, environment configuration, database migration lifecycle, observability architecture, and verification runbook for **OutreachOS**.

---

## Current Integration Status

### Currently Functional (Phase 2B Baseline)
- **Authentication & Sessions**: NextAuth session tokens (JWT), password hashing (bcrypt), authenticated route middleware.
- **Tenant Isolation**: Strict user-level resource partitioning across leads, companies, interactions, and analytics.
- **Lead Management**: Full CRUD operations with normalized email, LinkedIn URL, and company fields.
- **Deduplication Engine**: Deterministic 3-tier duplicate detection (Priority 1: Normalized Email, Priority 2: Normalized LinkedIn URL, Priority 3: Composite Name+Company).
- **Interactions & Audit Trail**: Chronological timeline audit logging with automatic `lastInteractionAt` tracking.
- **Analytics & Conversion Metrics**: PostgreSQL aggregations computing funnel drop-off, reply rates, and activity timeseries without fabricating data.
- **Client Finder Foundation**: Filter builder and preset archetypes with graceful unconfigured provider states.
- **Server-Side Validation**: Zod schema validation on all API endpoints with standardized field-level error mapping (`VALIDATION_ERROR`, `400`).
- **Standardized API Errors**: Unified error handling across `400`, `401`, `403`, `404`, `409`, and sanitized `500` responses.
- **Structured Observability**: Zero-overhead NDJSON logging to `process.stdout`/`process.stderr` with automatic secret/PII redaction and high-precision duration timing (`durationMs`).
- **Request Correlation**: Canonical `X-Request-ID` propagation from middleware through route handlers, responses, and log streams.
- **Health Diagnostics**: Lightweight `GET /api/health` performing a `SELECT 1` connectivity check, reporting `latencyMs`, and safe boolean configuration flags (200 OK / 503 Degraded).

### Not Yet Implemented (Future Phases)
- **Real External Prospect Discovery**: Real Apollo / Hunter / Proxycurl enrichment integrations (currently operates on graceful unconfigured provider).
- **AI Research & Pitch Generation**: Live OpenAI/Anthropic synthesis of website and LinkedIn intelligence (currently operates on preview/unconfigured adapter).
- **Production Email Dispatch**: Automated SMTP / Resend / SendGrid sequence dispatch workers.
- **Background Job Queue**: Asynchronous workers for scheduled follow-ups and reply-detection webhooks.
- **Google Calendar Synchronization**: Live OAuth synchronization and automated meeting booking links.
- **Production Billing**: Stripe subscriptions, usage metering, and paywalls.

> [!NOTE]
> All unconfigured providers fail gracefully and safely report their status (`isConfigured: false`) without crashing or degrading database health.

---

## A. Local Development Prerequisites

- **Node.js**: `v18.17.0` or higher (`v20.x` recommended)
- **npm**: `v9.x` or higher
- **Docker & Docker Compose**: For local PostgreSQL 16
- **Git**: Version control

---

## B. Environment Variables

Create `.env` (for local development) or `.env.local` based on `.env.example`.

### Required Variables
| Variable | Example Value | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/outreachos?schema=public` | Pooled connection string for application runtime |
| `DIRECT_URL` | `postgresql://postgres:postgres@localhost:5432/outreachos?schema=public` | Direct connection string for Prisma CLI migrations |
| `AUTH_SECRET` | `openssl rand -base64 32` | 32+ character key for JWT token encryption |
| `NEXTAUTH_URL` | `http://localhost:3000` | Canonical application base URL |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Client-facing base URL |

### Optional / Feature Configuration
| Variable | Default / Example | Description |
| :--- | :--- | :--- |
| `LOG_LEVEL` | `info` (prod) / `debug` (dev) | Logging threshold: `debug`, `info`, `warn`, `error` |
| `LOG_FORMAT` | `json` (prod) / `text` (dev) | Log formatting: `json` (NDJSON) or human-readable `text` |
| `OPENAI_API_KEY` | `""` | Optional key for future AI features |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model name for AI provider |
| `LEAD_SOURCE_API_KEY`| `""` | Optional key for future lead enrichment providers |
| `RESEND_API_KEY` | `""` | Optional key for future email sending |

> [!CAUTION]
> NEVER commit `.env` or `.env.local` to source control. They are strictly ignored by `.gitignore`.

---

## C. PostgreSQL Setup

### Local Docker Environment
Start the dedicated PostgreSQL 16 container:
```bash
docker compose up -d
```

Verify container health:
```bash
docker compose ps
```

Stop the container:
```bash
docker compose down
```

---

## D. Prisma Migration Workflow

OutreachOS uses version-controlled Prisma migrations.

1. **Verify Schema Validity**:
   ```bash
   npx prisma validate
   ```

2. **Generate Prisma Client**:
   ```bash
   npx prisma generate
   ```

3. **Check Migration Status**:
   ```bash
   npx prisma migrate status
   ```

4. **Apply Migrations in Development**:
   ```bash
   npm run prisma:migrate
   ```

5. **Deploy Migrations in Production/Staging**:
   ```bash
   npm run prisma:deploy
   # Alternatively: npx prisma migrate deploy
   ```

---

## E. Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run database migrations:
   ```bash
   npm run prisma:deploy
   ```

3. Start development server:
   ```bash
   npm run dev
   ```
   Navigate to [http://localhost:3000](http://localhost:3000).

---

## F. Running Tests

The automated test suite runs via the native Node.js Test Runner using `tsx`:

```bash
# Run all 128 tests across 11 test suites
npm test

# Run specific test suites
npx tsx --test tests/smoke.test.ts
npx tsx --test tests/observability.test.ts
npx tsx --test tests/validation.test.ts
npx tsx --test tests/query-optimization.test.ts
```

---

## G. Production Build

Build the production bundle locally or in CI:

```bash
# Typecheck TypeScript source
npm run typecheck

# Lint source files
npm run lint

# Build production assets
npm run build
```

Run the built production application:
```bash
npm run start
```

---

## H. Vercel Deployment Steps

1. **Import Repository**:
   Connect your GitHub repository to Vercel.
2. **Framework Preset**:
   Select **Next.js**.
3. **Root Directory**:
   Leave as `./`.
4. **Build Command**:
   `npm run build` (runs `prisma generate && next build`).
5. **Install Command**:
   `npm install`.
6. **Deploy**:
   Click Deploy. Once complete, your serverless functions and dynamic routes will be live.

---

## I. Production Environment Variables (Vercel)

Configure the following under **Project Settings > Environment Variables**:

| Variable | Target | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | Production, Preview | Managed PostgreSQL connection string (pooled, e.g. Neon, Supabase, PgBouncer) with pool parameters: `?schema=public&connection_limit=5&pool_timeout=10&connect_timeout=5` |
| `DIRECT_URL` | Production, Preview | Direct connection string to port 5432 for migrations |
| `AUTH_SECRET` | Production, Preview | High-entropy 32+ byte string generated via `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Production, Preview | Production domain URL (e.g. `https://your-domain.vercel.app`) |
| `NEXT_PUBLIC_APP_URL` | Production, Preview | Production domain URL (e.g. `https://your-domain.vercel.app`) |
| `LOG_LEVEL` | Production | `info` |
| `LOG_FORMAT` | Production | `json` |

---

## J. Database Migration Deployment

Before promoting a new release to production traffic, run migrations against the production PostgreSQL instance using `DIRECT_URL`:

```bash
npx prisma migrate deploy
```

In GitHub Actions or CI/CD pipelines, this should execute as a pre-deployment step prior to triggering the production deployment.

---

## K. Health Endpoint

Check operational status via HTTP `GET /api/health`:

- **Status 200 OK**: PostgreSQL database reachable and responsive.
- **Status 503 Service Unavailable**: Database disconnected or pool unreachable.

### Example Response:
```json
{
  "status": "ok",
  "database": {
    "connected": true,
    "latencyMs": 4,
    "error": null
  },
  "aiConfigured": false,
  "prospectProviderConfigured": false,
  "emailConfigured": false,
  "providers": {
    "leadSource": {
      "name": "Permitted B2B Lead Discovery (Unconfigured)",
      "isConfigured": false
    },
    "ai": {
      "name": "OpenAI Compatible (Unconfigured)",
      "isConfigured": false
    }
  },
  "timestamp": "2026-09-17T15:02:01.173Z"
}
```

Response Headers include canonical request tracking:
```http
X-Request-ID: 3c256ebf-474c-476b-80f5-bd4f82ad2c2f
```

---

## L. Release Readiness Checklist

Before tagging or promoting a release, verify all items:

- [x] **Automated Tests Pass**: All 128 tests passing (`npm test`).
- [x] **Typecheck Passes**: 0 TypeScript compilation errors (`npm run typecheck`).
- [x] **Lint Passes**: 0 ESLint warnings or errors (`npm run lint`).
- [x] **Prisma Validation Passes**: `npx prisma validate` reports schema is valid.
- [x] **Prisma Client Generated**: `npx prisma generate` builds client cleanly.
- [x] **Production Build Passes**: `npm run build` succeeds for all routes.
- [x] **Production Server Starts**: `npm run start` launches successfully.
- [x] **Smoke Tests Pass**: All 26 end-to-end smoke test requirements verified.
- [x] **Migrations Are Deployable**: `npx prisma migrate deploy` succeeds with zero errors.
- [x] **Secrets Are Excluded**: `.env` and `.env.local` strictly ignored by git; zero API keys committed.
- [x] **Environment Variables Documented**: Clean template in `.env.example`.
- [x] **Authentication Verified**: 401 on missing session, cookie token decryption operational.
- [x] **Tenant Isolation Verified**: Cross-tenant lead reads/updates/deletes rejected with 403.
- [x] **Health Endpoint Verified**: Returns 200 with `latencyMs`, 503 when DB down, exposes zero secrets.
- [x] **Error Responses Sanitized**: 500 responses return `INTERNAL_SERVER_ERROR` with `requestId` and zero stack traces.
- [x] **Vercel/Serverless Assumptions Checked**: Zero filesystem writes, zero long-running workers, NDJSON logging to stdout.
