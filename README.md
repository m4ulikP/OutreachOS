# OutreachOS

OutreachOS is an open sales workspace and client-management platform designed specifically for freelancers, consultants, and independent operators. It provides a structured environment to discover target prospects, organize pipeline stages, craft tailored outreach, and monitor client acquisition velocity.

The platform is designed around the **Freelancer Sales Studio** visual identity: a warm, low-chrome workspace prioritizing typography, deliberate spacing, and restrained semantic color over decorative dashboard clutter.

---

## Current Status

OutreachOS is currently in active development (Phase 1 Foundation). The core database architecture, pipeline workflows, deduplication engine, and responsive studio interface are fully functional.

| Component | Status | Description |
| :--- | :--- | :--- |
| **Workspace Shell & Design System** | Implemented | Responsive studio shell, light/dark mode, warm neutral palette, burnt orange action system |
| **Pipeline & Attention Deck** | Implemented | Operational "Today" attention strip, continuous 6-stage connected pipeline progression |
| **Lead Database & Management** | Implemented | Full CRUD operations, stage progression, temperature tagging, inline search, CSV import/export |
| **3-Tier Deduplication Engine** | Implemented | Multi-attribute deduplication: email, LinkedIn URL, and composite name+company hashing |
| **Client Finder Interface** | Implemented | Prospect query builder with pre-configured target archetypes (SaaS, E-commerce, Agencies, Fintech) |
| **Personalization Studio Interface**| Implemented | Fact-safeguard architecture and structured 3-step tailored pitch review interface |
| **Campaigns & Meetings Interface** | Implemented | Multi-step cadence architecture view and automated calendar transition configuration |
| **Analytics Foundation** | Implemented | Real-time conversion metrics, lead drop funnel, and daily activity volume charts |
| **Database & ORM Layer** | Implemented | PostgreSQL 16 schema with Prisma ORM (13 models, relations, indices, enums) |
| **Health & Diagnostic Monitoring** | Implemented | Live database connection polling and status indicator in navigation bar |
| **Automated Test Suite** | Implemented | 22 unit and integration tests covering deduplication, normalizers, isolation, and analytics |
| **Live B2B Provider Integration** | Planned | Third-party enrichment APIs (Apollo, Hunter, Proxycurl) |
| **Production LLM Email Generation** | Planned | Provider-backed fact extraction and automated pitch drafting |
| **Automated Sequence Dispatch** | Planned | Background job queue for email sending, open tracking, and reply detection |
| **Google Calendar Synchronization** | Planned | OAuth integration and automated discovery call booking links |

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
| `EMAIL_SERVER_HOST` | Future | SMTP host for automated sequence dispatch |
| `GOOGLE_CLIENT_ID` | Future | Google OAuth client ID for Calendar integration |

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

The project includes an automated test suite verifying business logic, security rules, and data integrity:

```bash
# Run unit & integration tests (22 tests)
npm test

# Run TypeScript typecheck
npm run typecheck

# Build production bundle
npm run build
```

### Test Coverage
- **Normalizers** (`tests/normalizer.test.ts`): Email sanitation (Gmail dots/sub-addresses), LinkedIn URL canonicalization, company domain stripping, and composite key hashing.
- **Deduplication** (`tests/deduplication.test.ts`): 3-tier duplicate detection across email, LinkedIn URL, and composite name+company.
- **Authorization** (`tests/authorization.test.ts`): Tenant isolation and cross-tenant access prevention.
- **Analytics** (`tests/analytics.test.ts`): Safe metric derivations, zero-division protection, and conversion rate calculations.

---

## Project Roadmap

- [x] Phase 1 Foundation: Application shell, Freelancer Sales Studio design system, light/dark themes
- [x] PostgreSQL database schema with Prisma ORM (13 models, relations, indices)
- [x] Full-featured Lead Database with search, multi-stage filtering, and detail page
- [x] 3-Tier deterministic deduplication engine with tests
- [x] Client Finder query builder with target archetypes
- [x] Attention Deck and continuous 6-stage connected pipeline ribbon
- [x] Automated test suite (22 unit & integration tests)
- [ ] Phase 2: Live B2B prospect provider integration (Apollo / Hunter APIs)
- [ ] Phase 2: AI website & LinkedIn profile context research
- [ ] Phase 2: LLM-powered personalized pitch generation with fact validation
- [ ] Phase 3: Automated multi-step cold email sequencing via SMTP/Resend
- [ ] Phase 3: Reply detection webhook receiver and thread pause logic
- [ ] Phase 4: Google Calendar OAuth integration and personalized booking links
- [ ] Phase 5: Advanced cohort analytics and conversion velocity reporting

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
