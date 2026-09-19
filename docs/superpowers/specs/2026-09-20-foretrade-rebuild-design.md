# ForeTrade rebuild: product and technical design

**Status:** Approved product direction; ready for implementation planning  
**Date:** 2026-09-20  
**Audience:** Indian exporters initially; global-ready architecture  
**Budget:** Zero paid services or data subscriptions required for the first release

## 1. Product definition

ForeTrade is a B2B trade-intelligence workspace for Indian exporters. It helps an exporter identify attractive export markets, import or maintain a private company list, prioritise that list with transparent criteria, and record actual outreach and pipeline events.

The product must be credible as a real SaaS application. It must distinguish between public data, user-supplied data, derived scores, and demonstration data. It must never fabricate a company contact, sent email, buyer response, meeting, lead outcome, live market signal, or machine-learning accuracy.

### Success criteria

An exporter can create a workspace, complete an exporter profile, explore public market data, upload a CSV/XLSX company list, map and validate columns, import companies, receive explainable rankings, update real pipeline stages, record activities, reload the application, and recover the same private data. A reviewer can explore a clearly marked demo workspace without access to other data.

The implementation must be runnable locally without paid accounts through Docker Compose and documented seed data. A production deployment configuration may use a no-cost hosting tier where available, but the local product must not rely on it.

## 2. Scope

### Release features

1. Authentication and workspace isolation
2. Exporter onboarding and profile management
3. India-origin Market Explorer using versioned public trade snapshots
4. CSV/XLSX import, mapping, validation, deduplication, and provenance
5. Private company catalogue, search, filters, saved views, tags, and pagination
6. Explainable opportunity scoring and configurable priorities
7. Lead pipeline with actual activity records, notes, and reminders
8. Editable outreach drafts with copy/export actions only
9. Analytics based on stored events and explicit data-quality states
10. Demo workspace, API documentation, automated tests, CI, and local deployment documentation

### Explicit non-goals for this release

- Purchased company/contact data, contact verification, or CRM enrichment APIs
- Sending email, WhatsApp, LinkedIn messages, or calendar invitations
- Compliance-grade sanctions screening
- Live customs feeds or claims of real-time market data
- Billing, subscriptions, native mobile applications, or organisation-level SSO
- A predictive model promoted as accurate before it has sufficient observed outcomes
- Full multilingual UI; all user-facing copy is English, with i18n-safe code structure

## 3. User roles and user journeys

### Export manager

Owns an exporter workspace. Can configure the profile, import companies, score/review leads, update the pipeline, create notes/drafts, and view analytics.

### Workspace member

Optional role for later invitation support. The database and authorisation policy support `owner`, `editor`, and `viewer` now. The first UI creates only the owner account; invitation delivery is deferred.

### Demo visitor

Uses a dedicated, read-only seeded demo workspace. No demo action changes shared seed data. The UI visibly identifies it as demonstration data.

### Primary journey

1. Register, sign in, and create an exporter workspace.
2. Provide company name, Indian origin, products/HS codes, capacity, certifications, preferred regions, target order size, and scoring preferences.
3. Explore India-to-destination opportunity data by HS product and save countries of interest.
4. Upload a prospect list, map fields, inspect validation and duplicate results, then commit the import.
5. Filter companies and review the score, evidence, data confidence, and source details.
6. Promote a company into the lead pipeline; record real activities and change stage only when the action occurred.
7. Draft outreach, copy/export it, then manually record the contact event if it is sent elsewhere.
8. Review analytics and export reports.

## 4. Product modules

### 4.1 Authentication and workspaces

- Email/password authentication using Argon2id hashes and server-managed secure, HTTP-only session cookies.
- CSRF protection for state-changing cookie-authenticated requests.
- No client-controlled identity, local-storage authentication token, hard-coded demo password, or URL-based login shortcut.
- Every domain record belongs to a workspace. Every API query checks workspace membership before reading or writing data.
- Sign-out invalidates the current session and clears client-side query caches.
- Development seed users are created only by the seed command and use documented local-only credentials.

### 4.2 Exporter profile

Required fields are company name, origin country (India preselected), at least one product or HS code, and at least one target preference. Optional fields include capacity, certifications, minimum order value, preferred trade regions, preferred currencies, and notes.

The profile is versioned. Updating it causes an asynchronous rescore of affected imported companies and stores which profile version produced each score.

### 4.3 Market Explorer

Market Explorer starts with India as the reporter/origin country. A user chooses an HS code or product category, time period, and destination filters.

The result table includes destination country, latest export value, year-over-year growth, trend window, market concentration where data exists, tariff/context availability, data year, source, and refresh timestamp. It does not call historical data “live.”

The market score is an explicit weighted score with input availability indicators:

```
market_score = 0.40 * normalized_export_value
             + 0.30 * normalized_growth
             + 0.15 * diversification_score
             + 0.15 * exporter_preference_fit
```

Missing inputs lower score confidence rather than being silently converted to favourable values. Users can save market watchlist entries with notes.

### 4.4 Company import

The importer accepts CSV and XLSX files with a configurable size limit. It creates an import job and stores the original file privately. Parsing runs asynchronously.

The mapping screen identifies likely columns and lets the user map source fields to canonical fields. Required canonical fields are company name, country, and product/industry. The user sees preview rows and row-level validation before committing.

Canonical optional fields: website, contact name, email, phone, city, company size, trade volume, last interaction date, source URL, source reference, tags, and notes.

The import report separates accepted, warning, rejected, and duplicate rows. A committed import is idempotent using source-file hash plus row fingerprint. It can be rolled back only by creating a compensating archive operation; import provenance remains visible.

No record is enriched with invented fields. Email and website are displayed as unverified unless the user supplies a verification state.

### 4.5 Company catalogue and opportunities

Companies are private workspace records. The catalogue supports server-side pagination, full-text search, country/product/tag filters, sort order, saved views, and bulk tagging.

An opportunity is a workspace-specific company evaluation. It stores its score snapshot, explanation, scoring configuration version, exporter profile version, data completeness, and timestamp. Ranking remains stable for a given snapshot. Rescoring creates a new score snapshot rather than rewriting history.

### 4.6 Explainable scoring

The first scoring engine is deterministic and configured by workspace preferences. It never represents a score as success probability.

```
opportunity_score = 0.30 * product_fit
                  + 0.20 * target_market_fit
                  + 0.15 * exporter_capacity_fit
                  + 0.15 * certification_fit
                  + 0.10 * data_quality
                  + 0.10 * user_priority_fit
```

Each term is normalized to [0, 100], records its source fields, and may be unavailable. The response includes contribution, input values, missing requirements, and a confidence label based on data completeness. Product fit requires an actual industry/HS match or declared product synonym; unrelated products are ineligible by default.

Users can create named scoring presets. A score is recalculated only when relevant profile, company, market, or preset data changes.

### 4.7 Pipeline and activity tracking

Lead stages are `new`, `qualified`, `contacted`, `replied`, `meeting`, `won`, and `lost`. Stage changes require a stored event. For example, a lead cannot be marked `replied` without a manually recorded received-response event.

Events include note, contact attempt, reply received, meeting, stage change, reminder, and draft exported. They capture actor, time, free-text note, and optional structured metadata. Activities are append-only; corrections create a visible correction event.

### 4.8 Outreach

Users can generate a structured, editable draft from selected company and exporter fields. The initial generator is a deterministic template service, so it needs no paid LLM. It includes an explicit warning whenever important prospect information is missing.

The user may copy a draft, download it as text, or mark it exported. Exported does not mean sent. Later email-provider integrations remain a separate adapter boundary.

### 4.9 Analytics

Analytics are calculated from workspace records and events. They include import quality, company coverage, score distribution, active pipeline count by stage, stage conversion based on stored transitions, saved markets, activity volume, and stale data alerts. Empty states describe the absent prerequisite rather than showing fake zero-success metrics.

## 5. Data architecture and provenance

### Public trade data

Use a versioned, normalised trade snapshot with a source and source period on every row. Initial sources are UN Comtrade and World Bank WITS/UNCTAD TRAINS where an appropriate free endpoint or manually prepared public extract is available. API limits mean the product must work from seeded snapshots and background refreshes; no interactive screen depends on unbounded upstream calls.

The initial seed focuses on a limited set of Indian export-relevant HS categories and destination countries, sufficient for an excellent Market Explorer demo. The ingestion format supports additional products, periods, reporters, partners, and source datasets without schema changes.

### User data

Original file metadata: storage key, checksum, MIME type, size, importer, timestamp, parser version, mapping version, and retention/archive state. Normalised rows retain source row number and raw fields. Canonical company records retain user edits separately from import data.

### Demo data

Seeded demo data is in a separate demo workspace and contains a `data_classification = demo` marker. It uses curated fictional companies and clearly labelled values. It cannot be mixed into normal workspace analytics.

## 6. Technical architecture

### Services

```text
browser
  -> Next.js application (React, TypeScript)
  -> FastAPI REST API
      -> PostgreSQL
      -> Redis queue
      -> worker service
      -> S3-compatible object storage
```

Local development uses Docker Compose for PostgreSQL, Redis, MinIO-compatible object storage, API, worker, and web application. The application does not require a paid cloud resource to run locally.

### Frontend

Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, React Hook Form, Zod, and a generated typed API client. Route groups separate authenticated workspace screens and public auth/demo routes. Browser state holds only UI state; server data stays in query cache and is invalidated after mutations.

### Backend

FastAPI, Pydantic v2, SQLAlchemy 2, Alembic, PostgreSQL, and Redis-backed Dramatiq or Celery workers. REST endpoints use resource ownership checks in a shared dependency. Background work uses durable job records with status, progress, attempts, error summaries, and correlation IDs.

### Storage and jobs

Object storage stores original upload files. Postgres stores metadata, parsed data, and audit events. Background jobs process imports, score recalculations, snapshot ingestion, and scheduled stale-data checks. Jobs are idempotent, retry bounded times, and expose failure state to the UI.

### Future ML boundary

An offline Python package contains dataset building, feature definitions, training, evaluation, and model registry code. It does not run in HTTP requests. A trained model may only become an optional score component when evaluation shows improvement over the rule baseline on time-separated observed outcome data.

## 7. Core data model

Key tables:

- `users`, `sessions`
- `workspaces`, `workspace_members`
- `exporter_profiles`, `exporter_profile_products`, `certifications`, `scoring_presets`
- `trade_data_sources`, `trade_data_snapshots`, `trade_market_metrics`
- `market_watchlist_entries`
- `import_jobs`, `import_files`, `import_mappings`, `import_rows`, `import_validation_issues`
- `companies`, `company_sources`, `company_tags`, `company_tag_links`
- `opportunity_scores`, `opportunity_explanations`
- `leads`, `lead_stage_transitions`, `lead_events`, `reminders`, `outreach_drafts`
- `saved_views`, `audit_events`, `background_jobs`

All workspace-owned tables contain `workspace_id`, indexed alongside frequent filter keys. Company records are never globally shared by default. Foreign-key enforcement is enabled for all database connections. Soft archive is used where audit history matters; accidental destructive deletes are avoided.

## 8. API surface

The API version prefix is `/api/v1`. The OpenAPI schema is generated in CI and used to build frontend types.

Resource groups:

- `/auth`: registration, sign-in, sign-out, current session
- `/workspaces`, `/exporter-profile`, `/scoring-presets`
- `/markets`, `/market-watchlist`, `/trade-data-status`
- `/imports`, `/imports/{id}/preview`, `/imports/{id}/mapping`, `/imports/{id}/commit`
- `/companies`, `/companies/{id}`, `/companies/{id}/tags`, `/saved-views`
- `/opportunities`, `/opportunities/{company_id}/rescore`
- `/leads`, `/leads/{id}/events`, `/leads/{id}/stage`, `/reminders`, `/outreach-drafts`
- `/analytics`, `/exports`
- `/jobs/{id}`

List endpoints require explicit pagination and return data, total count, cursor/page metadata, and applied filters. Mutations return the current resource or a durable job reference. Errors use a stable problem-details style payload with safe user messages and correlation ID.

## 9. Security and reliability requirements

- Argon2id password hashing, rate limiting for authentication, secure cookie flags, CSRF defense, input validation, and security headers.
- Workspace-level authorization for every read/write endpoint and every background job.
- File type/content validation, server-side size limits, non-executable uploads, random object keys, and malware scanning adapter boundary.
- Sanitised logs: never log passwords, session cookies, raw uploaded file content, or user contact details.
- Database constraints, transactions for multi-record mutations, idempotency keys for import commit and rescore actions.
- Audit events for sign-in, import commit, profile/preset change, stage transition, archive, and export actions.
- Structured logs and health/readiness endpoints.
- Accessibility target: keyboard-operable forms/tables, labelled controls, visible focus, semantic errors, and responsive layouts.

## 10. Test and quality strategy

### Backend

Pytest tests cover auth, workspace isolation, import validation/mapping, duplicate detection, score calculations, stage-transition rules, job idempotency, and API authorisation. PostgreSQL integration tests run in containers. Property-style tests cover malformed imports and score bounds.

### Frontend

Vitest tests reusable UI logic; Playwright exercises the primary journey: register, onboard, explore markets, upload/mapping preview, import, score, lead progression, reload, and data isolation. Accessibility checks cover critical pages.

### Data and scoring

Data-contract tests validate required columns, types, source metadata, unique keys, permissible dates, and score input ranges. Golden fixture tests protect score explanations. Market snapshot ingestion produces data-quality reports.

### CI and release checks

Run formatting, linting, type checks, migration validation, backend tests, frontend tests, E2E smoke tests, container build, and dependency/security audit. A release candidate must run from an empty local database using documented commands.

## 11. One-week delivery sequence

### Day 1: platform foundation

Monorepo layout, Docker Compose, API/web/worker scaffolding, Postgres/Redis/object storage, migrations, secure auth, workspace boundaries, CI, seed command, and local documentation.

### Day 2: profile and market data

Exporter onboarding, HS/product model, trade snapshot schema and seed ingest, Market Explorer list/detail/compare/watchlist, provenance display, and score explanations.

### Day 3: import system

Upload endpoint, object storage, async jobs, CSV/XLSX parser, mapping wizard, preview, validation report, deduplication, commit, rollback/archive, and import tests.

### Day 4: opportunities and leads

Company catalogue, filtering/search/pagination/tags/saved views, deterministic scores, lead creation, event timeline, real stage-transition policy, reminders, and authorisation tests.

### Day 5: outreach and analytics

Template drafts/copy/export, analytics, report export, empty states, demo workspace, responsive polish, accessibility work, and recruiter walkthrough flow.

### Day 6: reliability

E2E tests, permission probes, import stress fixtures, error/retry UX, migration/reseed test, clean environment startup, and observability.

### Day 7: release quality

Documentation, screenshots/video, architecture diagram, API docs, final seed/demo QA, release checklist, and deployment configuration.

Each day ends with a runnable vertical slice. If a feature is incomplete, it remains hidden behind a feature flag or is omitted; it is not represented as working.

## 12. Resume demonstration

The demo starts in an explicitly labelled workspace. It shows Market Explorer, then a CSV import with mapping/validation, then transparent scoring, then a genuine manually recorded activity and pipeline stage change. The presenter can show the audit timeline, score explanation, source period, API documentation, test suite, Docker topology, and data contract report.

The resume/project description should say: “Built a full-stack trade-intelligence workspace for Indian exporters with FastAPI, Next.js, PostgreSQL, asynchronous data imports, source-aware market analysis, explainable lead ranking, and event-based pipeline tracking.” It should not claim live buyer discovery, successful deal prediction, or real-time data unless those become true.

## 13. Decisions recorded

1. India is the initial export origin; the schema supports future origins.
2. Market Explorer and user company imports are equally core workflows.
3. The release uses public/curated data and user uploads; it does not require paid APIs.
4. Scores are transparent prioritisation aids, not success probabilities.
5. Actual business events are entered or integrated; no simulated activity appears as real.
6. The product is delivered as a fully working release slice, with expensive/unsupported integrations deliberately excluded rather than mocked.
