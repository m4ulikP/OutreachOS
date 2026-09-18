# OutreachOS

OutreachOS is an open sales workspace and client-management platform designed specifically for freelancers, consultants, and independent operators. It provides a structured environment to discover target prospects, organize pipeline stages, craft tailored outreach, and monitor client acquisition velocity.

The platform is designed around the **Freelancer Sales Studio** visual identity: a warm, low-chrome workspace prioritizing typography, deliberate spacing, and restrained semantic color over decorative dashboard clutter.

---

## Current Status

OutreachOS has completed **Phase 2B: Production Infrastructure, Reliability & Observability**. The application is production-ready for serverless deployment on Next.js/Vercel with hosted PostgreSQL.

For full deployment instructions, environment variable specifications, and release runbook, see [**DEPLOYMENT.md**](./DEPLOYMENT.md).

| Component | Status | Description |
| :--- | :--- | :--- |
| **Authentication & Isolation** | Production-Ready | NextAuth session cookies (JWT), bcrypt password hashing, strict multi-tenant data isolation |
| **Database & Migrations** | Production-Ready | Version-controlled Prisma migrations (`prisma migrate deploy`), serverless pooling parameters |
| **O(1) Deduplication Engine** | Production-Ready | Multi-attribute deduplication: email, LinkedIn URL, and composite name+company hashing |
| **Query & Index Optimization** | Production-Ready | Compound B-tree indexes, atomic Prisma transactions, database-level SQL aggregations |
| **Runtime Input Validation** | Production-Ready | Zod schemas protecting all API routes against mass-assignment, injection, and invalid payloads |
| **Standardized Error Handling**| Production-Ready | Unified domain exceptions mapping to 400, 401, 403, 404, 409, and sanitized 500 responses |
| **Structured Observability** | Production-Ready | Zero-dependency NDJSON logging, automatic secret/PII redaction, high-precision request timing |
| **Request ID Correlation** | Production-Ready | Canonical `X-Request-ID` generation/validation, middleware propagation, and response headers |
| **Health Diagnostics** | Production-Ready | Lightweight `GET /api/health` performing `SELECT 1`, measuring `latencyMs`, returning 200/503 |
| **Automated Test Suite** | Production-Ready | 128 automated unit, integration, and E2E smoke tests across 11 test suites (100% passing) |
| **Freelancer Sales Studio UI** | Implemented | Responsive studio shell, light/dark mode, warm neutral palette, burnt orange action system |
| **Live B2B Enrichment API** | Planned (Phase 3) | Apollo, Hunter, Proxycurl live integrations (graceful unconfigured adapter active) |
| **AI LLM Pitch Generation** | Planned (Phase 3) | Live OpenAI/Anthropic intelligence synthesis (graceful preview adapter active) |
| **Automated Sequence Dispatch** | Planned (Phase 3) | Background job queue for email sending, open tracking, and reply detection |
| **Google Calendar Sync** | Planned (Phase 4) | OAuth integration and automated discovery call booking links |

---

## Core Product Vision

OutreachOS bridges the gap between manual spreadsheets and oversized enterprise CRMs by providing a focused, end-to-end freelancer sales loop:

```
Target Prospect Discovery
         ↓
Lead Qualification & Deduplication
         ↓
Company Context & Signal Extraction
         ↓
Tailored Outreach Drafting & Review
         ↓
Multi-Touch Sequence Dispatch
         ↓
Reply Detection & Thread Pausing
         ↓
Discovery Call Scheduling
         ↓
Client Contract Conversion
         ↓
Acquisition Analytics & Review
```

---

## Current Features

### 1. Studio Workspace (Dashboard)
- **Today Attention Deck**: Actionable operational summary highlighting pending positive replies, follow-ups due, scheduled discovery calls, and total active pipeline volume.
- **Continuous 6-Stage Connected Pipeline**: Visual pipeline progression linking prospects through `New` ➔ `Contacted` ➔ `Replied` ➔ `Positive` ➔ `Discovery Call` ➔ `Client`.
- **Next Steps Launchpad**: Interactive setup checklist guiding the operator through database initialization, target criteria definition, lead creation, and sequence configuration.
- **Workspace Ledger Feeds**: Compact split ledger feeds for recent prospects, upcoming meetings, and system activity.

### 2. Lead Management & Pipeline Database
- **Structured Lead Profiles**: Captures contact data, company size, industry, location, LinkedIn profiles, websites, pipeline stages, temperature tags, and freeform intelligence notes.
- **Stage Navigation Tabs**: Instant stage filtering with prospect counts across all 6 pipeline milestones.
- **Single-Click Actions**: Instant clipboard email copy with visual checkmark confirmation, LinkedIn profile shortcuts, and manual stage progression.
- **Lead Detail View**: Dedicated detail page with chronological interaction audit logging, notes persistence, and contextual action triggers.
- **CSV Data Portability**: Client-side CSV import with field mapping and export utilities.

### 3. 3-Tier Deterministic Deduplication
Prevents duplicate outreach and protects sender reputation:
1. **Tier 1 (Email)**: Normalized email matching (strips Gmail dots/sub-addressing, trims whitespace, standardizes case).
2. **Tier 2 (LinkedIn URL)**: Normalized URL comparison (canonicalizes protocol, trailing slashes, subdomains, and tracking parameters).
3. **Tier 3 (Composite Key)**: SHA-256 hash matching on sanitized `fullName + companyDomain` when direct contact identifiers are unavailable.

### 4. Client Finder
- Search criteria builder for job titles, company headcount, industries, locations, and tech stack keywords.
- Pre-configured target archetypes for instant filter loading: SaaS Founders, E-Commerce Growth Heads, Agency Principals, and Fintech Product Leaders.

### 5. Sales & Outreach Analytics
- Core performance KPIs: Total Leads, Emails Sent, Reply Rate (%), Positive Reply Count, Meetings Booked, Clients Closed, and Monthly Conversion Velocity (%).
- Stage drop-off funnel chart and multi-metric daily outreach activity graphs powered by Recharts.
- Zero-division guards and safe fallbacks for empty databases.

### 6. Freelancer Sales Studio Design System
- Built with Tailwind CSS and CSS custom properties for instant light/dark theme switching.
- **Dark Mode**: Charcoal slate background (`#151513`), warm surfaces (`#1D1C19` / `#24231F`), and burnt orange brand action CTA (`#D96C3A`).
- **Light Mode**: Warm linen background (`#F4F1EA`), surface (`#FBF9F4`), elevated white containers (`#FFFFFF`), and accessible burnt orange (`#C85F32`).
- **Semantic Signals**: Muted sage (`#78A878` / `#3F703F`), ochre (`#C49A58` / `#8F6623`), muted red (`#C9655D` / `#A63830`), and dusty blue (`#7896A8` / `#386782`).

---

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) 14 (App Router, Server & Client Components)
- **UI Library**: [React](https://react.dev/) 18
- **Language**: [TypeScript](https://www.typescriptlang.org/) 5
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) 3 with CSS Custom Properties
- **Database**: [PostgreSQL](https://www.postgresql.org/) 16
- **ORM**: [Prisma ORM](https://www.prisma.io/) 5
- **Icons**: [Lucide React](https://lucide.dev/)
- **Charts**: [Recharts](https://recharts.org/)
- **Containerization**: [Docker](https://www.docker.com/) & Docker Compose
- **Test Runner**: Node.js Test Runner via `tsx` / [Vitest](https://vitest.dev/)

---

## Architecture Overview

```
OutreachOS/
├── docker-compose.yml        # PostgreSQL 16 container definition
├── prisma/
│   └── schema.prisma         # Database schema, relations, indices, enums
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── (dashboard)/      # Authenticated workspace layout and views
│   │   │   ├── page.tsx      # Dashboard (Today, Pipeline, Next steps, Feeds)
│   │   │   ├── leads/        # Lead database, filtering, and detail view
│   │   │   ├── finder/       # Client Finder query builder
│   │   │   ├── campaigns/    # Sequence cadence and campaign management
│   │   │   ├── personalization/ # Pitch drafting and fact safeguards
│   │   │   ├── meetings/     # Booking links and calendar sync
│   │   │   ├── analytics/    # Conversion metrics and activity charts
│   │   │   └── settings/     # Integrations, credentials, and profile
│   │   ├── api/              # Route handlers (REST endpoints)
│   │   │   ├── health/       # Database and provider health checks
│   │   │   ├── leads/        # Lead CRUD, batch import, and deduplication
│   │   │   ├── analytics/    # Aggregate conversion calculations
│   │   │   └── finder/       # Prospect discovery endpoint
│   │   ├── globals.css       # Design tokens, color system, and typography
│   │   └── layout.tsx        # Root HTML shell and theme initialization
│   ├── components/           # Modular UI components
│   │   ├── layout/           # Sidebar, top-nav, theme-toggle
│   │   ├── dashboard/        # Attention deck, pipeline ribbon, launchpad, charts
│   │   ├── leads/            # Lead table, filters, modal, delete dialog
│   │   └── ui/               # Primitives (Button, Badge, Card, Input, Dialog, etc.)
│   └── lib/                  # Core domain logic
│       ├── db.ts             # Prisma client instance and health verification
│       ├── deduplication/    # Normalizers and 3-tier duplicate detection
│       ├── providers/        # Lead source and AI provider adapters
│       └── utils.ts          # Class merging, date formatting, rate limiting
└── tests/                    # Unit and integration test suites
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18.17.0 or higher recommended)
- [npm](https://www.npmjs.com/) (v9 or higher)
- [Docker](https://www.docker.com/) and Docker Compose (for local PostgreSQL)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/m4ulikP/OutreachOS.git
   cd OutreachOS
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   The default `.env.example` is pre-configured to connect to the local Docker PostgreSQL container on port 5432.

4. **Start the local PostgreSQL container**:
   ```bash
   docker compose up -d
   ```

5. **Initialize the database schema**:
   ```bash
   npm run prisma:push
   ```
   This generates the Prisma client and applies the schema directly to your local PostgreSQL instance.

6. **Start the development server**:
   ```bash
   npm run dev
   ```

7. **Open the application**:
   Navigate to [http://localhost:3000](http://localhost:3000) (or the port reported in terminal output if 3000 is occupied).

---

## Environment Variables

Copy `.env.example` to `.env` or `.env.local` and populate variables as needed:

| Variable | Required | Default / Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | Yes | `postgresql://postgres:postgres@localhost:5432/outreachos?schema=public` |
| `NEXT_PUBLIC_APP_URL` | Yes | `http://localhost:3000` |
| `AUTH_SECRET` | Yes | 32-character secret key for session and token signing |
| `OPENAI_API_KEY` | Optional | API key for AI personalization (leave blank for preview mode) |
| `OPENAI_BASE_URL` | Optional | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | Optional | `gpt-4o-mini` |
| `LEAD_SOURCE_API_KEY` | Optional | API key for third-party B2B data provider |
| `BREVO_API_KEY` | Optional | Brevo transactional email API key (server-side only) |
| `BREVO_FROM_EMAIL` | Optional | Verified sender email address configured in Brevo |
| `BREVO_FROM_NAME` | Optional | Sender display name (default: "OutreachOS Studio") |
| `EMAIL_DEV_MODE` | Optional | Set to `"true"` to force local in-memory offline queue |
| `EMAIL_SERVER_HOST` | Future | SMTP host for automated sequence dispatch |
| `GOOGLE_CLIENT_ID` | Future | Google OAuth client ID for Calendar integration |

---

## Transactional Email Architecture

OutreachOS uses a provider-agnostic `EmailProvider` architecture supporting seamless switching between local development and production delivery:

- **`DevelopmentEmailProvider`** (Local In-Memory / Offline):
  - Active by default in development or whenever `EMAIL_DEV_MODE="true"`.
  - Captures verification links and password reset tokens in an in-memory queue.
  - Zero external network calls; fully offline for local testing and automated CI suites.
- **`BrevoEmailProvider`** (Production Outbound Email):
  - Primary transactional provider for sending real email verification and password reset links.
  - Uses the official Brevo transactional email API (`@getbrevo/brevo`).
  - Includes bounded retries (max 2 retries on 5xx/network errors), fail-fast on 4xx, and 8-second timeout.

### Brevo Setup Instructions

To enable real outbound transactional emails:
1. **Create a Brevo account** at [brevo.com](https://www.brevo.com).
2. **Generate a Transactional API Key**: Navigate to *SMTP & API* → *API Keys* and generate a new key (e.g. `xkeysib-...`).
3. **Verify Sender / Domain**: Navigate to *Senders, Domains & Dedicated IPs* and add/verify your sender email or domain. Brevo requires a verified sender to deliver emails.
4. **Configure `.env.local`**:
   ```env
   BREVO_API_KEY="xkeysib-your-key-here"
   BREVO_FROM_EMAIL="outreach@yourverifieddomain.com"
   BREVO_FROM_NAME="OutreachOS Studio"
   EMAIL_DEV_MODE="false"
   ```
5. **Restart the development server**:
   ```bash
   npm run dev
   ```
6. **Test Outbound Delivery**:
   - Go to `/signup` to test email verification, or `/forgot-password` to test password reset.
   - Enter your email address.
   - Check your mailbox (including spam/junk folder).
   - Verify Brevo dispatch and message ID in server logs.

---

## Database Management

OutreachOS uses Prisma ORM with PostgreSQL. The following scripts are available:

- **Apply schema changes to database**:
  ```bash
  npm run prisma:push
  ```
- **Regenerate Prisma Client**:
  ```bash
  npm run prisma:generate
  ```
- **Open Prisma Studio (database GUI)**:
  ```bash
  npx prisma studio
  ```
- **Stop local PostgreSQL container**:
  ```bash
  docker compose down
  ```

---

## Testing & Quality Assurance

The project includes an automated test suite verifying business logic, security rules, data integrity, and end-to-end operational flows:

```bash
# Run all 128 tests across 11 test suites
npm test

# Run TypeScript typecheck
npm run typecheck

# Run ESLint validation
npm run lint

# Build production bundle
npm run build
```

### Test Coverage (128 Passing Tests Across 11 Suites)
- **Normalizers** (`tests/normalizer.test.ts`): Email sanitation (Gmail dots/sub-addresses), LinkedIn URL canonicalization, company domain stripping, and composite key hashing.
- **Deduplication** (`tests/deduplication.test.ts`): 3-tier duplicate detection across email, LinkedIn URL, and composite name+company.
- **Authorization** (`tests/authorization.test.ts`): Tenant isolation, session token verification, and cross-tenant access prevention.
- **Analytics** (`tests/analytics.test.ts`): Safe metric derivations, zero-division protection, and conversion rate calculations.
- **Database Schema** (`tests/database-schema.test.ts`): Model constraints, company per-user uniqueness, follow-up relations, and migration verification.
- **Query Optimization** (`tests/query-optimization.test.ts`): O(1) indexed deduplication queries, PostgreSQL execution plans, atomic Prisma transactions, and stage aggregation.
- **Validation** (`tests/validation.test.ts`): Runtime Zod schema enforcement, mass-assignment protection, query parameter bounds, and standardized API error formatting.
- **Observability** (`tests/observability.test.ts`): Structured NDJSON logger, secret/PII redaction, `X-Request-ID` propagation, error sanitization, and health check diagnostics.
- **Smoke Suite** (`tests/smoke.test.ts`): End-to-end integration flows across auth, leads, interactions, analytics, finder, health, and error sanitization.

---

## Project Roadmap

- [x] **Phase 1 Foundation**: Application shell, Freelancer Sales Studio design system, light/dark themes
- [x] **Phase 2A Audit**: Production infrastructure audit and readiness roadmap
- [x] **Phase 2B Milestone 1**: Security & Authentication Hardening (Session isolation, bcrypt, NextAuth)
- [x] **Phase 2B Milestone 2**: Database Migration Baseline & Indexing (Normalized fields, compound indexes)
- [x] **Phase 2B Milestone 3**: Query Optimization, Transactions & Scale (O(1) dedup, Prisma transactions, SQL analytics)
- [x] **Phase 2B Milestone 4**: Server-Side Zod Validation & Standardized Errors (Mass-assignment protection, standard errors)
- [x] **Phase 2B Milestone 5**: Production Logging, Health Diagnostics & Observability (NDJSON, secret redaction, request correlation)
- [x] **Phase 2B Milestone 6**: End-to-End Smoke Testing & Release Runbook (128 passing tests, deployment runbook)
- [ ] **Phase 3**: Live External Integrations (Apollo/Hunter B2B data, live OpenAI/Anthropic synthesis, automated email dispatch)
- [ ] **Phase 4**: Calendar Sync & Discovery Booking (Google Calendar OAuth, meeting scheduler)
- [ ] **Phase 5**: Advanced Sales Intelligence & Team Workspaces

---

## Contributing

Contributions, feedback, and bug reports are welcome as the project evolves.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'feat: add my feature'`
4. Ensure all validation passes: `npm test && npm run typecheck && npm run build`
5. Push to the branch: `git push origin feature/my-feature`
6. Open a Pull Request

---

## License

This project is currently unlicensed / all rights reserved. A formal open-source license will be determined prior to public distribution.
