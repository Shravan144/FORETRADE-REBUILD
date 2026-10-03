# ForeTrade Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a locally runnable trade-intelligence workspace for Indian exporters with secure workspaces, Market Explorer, private company imports, explainable prioritisation, and event-based lead tracking.

**Architecture:** Next.js consumes a FastAPI REST API. PostgreSQL is the source of truth, Redis carries durable jobs, and MinIO-compatible object storage keeps original import files. Deterministic scoring stores immutable snapshots; offline ML cannot affect product scores until evaluation proves improvement over the rule baseline.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, FastAPI, Pydantic v2, SQLAlchemy 2, Alembic, PostgreSQL, Redis, Dramatiq, MinIO, Docker Compose, Pytest, Vitest, Playwright, Ruff, mypy, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-20-foretrade-rebuild-design.md`

## Global Constraints

- Keep legacy Streamlit code intact; new product code lives in `apps/`, `packages/`, `infra/`, and `tests/`.
- Require Python `>=3.12,<3.14`, Node `>=22,<23`, PostgreSQL 16, Redis 7, and Docker Compose v2.
- Use only open-source dependencies and public/curated data; the complete local stack runs without paid credentials.
- Enforce `workspace_id` ownership in every workspace query and worker task.
- Use Argon2id, HTTP-only secure session cookies, CSRF protection, and optional Google OpenID Connect with PKCE.
- Never invent contact data, email delivery, buyer replies, meetings, outcomes, live signals, or model accuracy.
- Include source name, source period, dataset version, and refresh timestamp on public market metrics.
- Use explainable deterministic scores until time-separated observed outcomes justify ML.
- Preserve upload provenance; archive/correct records instead of destructive deletes.

## Review Focus

- A user requests another workspace's import, company, lead, file, or job ID: return 404/403 without leaking data.
- A CSV contains duplicate names, malformed dates, spreadsheet formulas, blanks, and non-UTF-8 text: preview reports row-level issues and commits nothing.
- A trade snapshot omits growth or concentration: lower confidence and name the missing input; never silently use a favourable default.
- A browser retries import commit or rescore after a timeout: idempotency prevents duplicate companies, events, and score snapshots.
- A user marks a lead replied or meeting: reject it unless a matching actual activity exists; exported drafts remain not sent.

---

## File structure

    apps/api/app/{api/v1,core,db,models,schemas,services,workers}
    apps/api/{alembic,tests}
    apps/web/{app,components,lib,tests}
    packages/{scoring,trade-data,ml}
    infra/{compose,scripts}
    docs/

API routes translate HTTP, services apply business rules, models persist state, workers process durable jobs, packages contain pure data/scoring/ML code, and frontend components are grouped by product capability. The existing Streamlit project remains the historical baseline until new release checks pass.

## Tasks

### Task 1: Create the monorepo and reproducible local stack

**Files:**
- Create: `README.md`, `.env.example`, `.gitignore`, `.editorconfig`, `.pre-commit-config.yaml`
- Create: `infra/compose/docker-compose.yml`, `infra/compose/Dockerfile.api`, `infra/compose/Dockerfile.web`
- Create: `apps/api/pyproject.toml`, `apps/api/app/main.py`, `apps/api/tests/test_health.py`
- Create: `apps/web/package.json`, `apps/web/next.config.ts`, `apps/web/app/page.tsx`, `apps/web/tests/smoke.test.tsx`
- Create: `infra/scripts/check-stack.ps1`, `infra/scripts/seed-local.ps1`

**Interfaces:** Produces `GET /healthz -> {"status":"ok","service":"api"}` and `docker compose -f infra/compose/docker-compose.yml up --build` with web, api, worker, postgres, redis, and minio services.

- [ ] **Step 1: Write failing health and page tests**

    def test_healthz(client):
        response = client.get("/healthz")
        assert response.status_code == 200
        assert response.json() == {"status": "ok", "service": "api"}

    it("renders the ForeTrade title", () => {
      render(<HomePage />)
      expect(screen.getByRole("heading", { name: /foretrade/i })).toBeInTheDocument()
    })

- [ ] **Step 2: Verify the tests fail**

Run: `cd apps/api; uv run pytest tests/test_health.py -v` and `cd apps/web; pnpm test -- smoke.test.tsx`

Expected: FAIL because the applications do not exist.

- [ ] **Step 3: Implement the minimum applications and Compose services**

    from fastapi import FastAPI
    app = FastAPI(title="ForeTrade API", version="0.1.0")

    @app.get("/healthz")
    def healthz() -> dict[str, str]:
        return {"status": "ok", "service": "api"}

    export default function HomePage() {
      return <main><h1>ForeTrade</h1><p>Trade intelligence for Indian exporters.</p></main>
    }

- [ ] **Step 4: Verify stack and tests**

Run: `docker compose -f infra/compose/docker-compose.yml up --build -d; powershell -ExecutionPolicy Bypass -File infra/scripts/check-stack.ps1; cd apps/api; uv run pytest tests/test_health.py -v; cd ../web; pnpm test -- smoke.test.tsx`

Expected: all services are healthy and tests PASS.

- [ ] **Step 5: Commit**

Run: `git add README.md .env.example .gitignore .editorconfig .pre-commit-config.yaml infra apps/api apps/web; git commit -m "chore: scaffold ForeTrade service stack"`

### Task 2: Establish database, migrations, request context, and audit events

**Files:**
- Create: `apps/api/app/core/config.py`, `apps/api/app/core/logging.py`, `apps/api/app/db/base.py`, `apps/api/app/db/session.py`
- Create: `apps/api/app/models/audit_event.py`, `apps/api/app/api/v1/system.py`
- Create: `apps/api/alembic.ini`, `apps/api/alembic/env.py`, `apps/api/alembic/versions/0001_platform.py`
- Test: `apps/api/tests/integration/test_migrations.py`, `apps/api/tests/test_request_context.py`

**Interfaces:** Produces `get_db() -> Generator[Session]`, `record_audit_event(session, *, workspace_id, actor_user_id, action, entity_type, entity_id, metadata) -> None`, and `GET /api/v1/system/status`.

- [ ] **Step 1: Write failing migration and request-ID tests**

    def test_database_has_audit_events_table(postgres_engine):
        assert "audit_events" in inspect(postgres_engine).get_table_names()

    def test_response_echoes_correlation_id(client):
        response = client.get("/api/v1/system/status", headers={"X-Request-ID": "test-request"})
        assert response.headers["X-Request-ID"] == "test-request"

- [ ] **Step 2: Verify the tests fail**

Run: `cd apps/api; uv run pytest tests/integration/test_migrations.py tests/test_request_context.py -v`

Expected: FAIL because migrations, audit table, and middleware are absent.

- [ ] **Step 3: Implement settings, sessions, migration, logs, and middleware**

    def record_audit_event(session: Session, *, workspace_id: UUID | None,
                           actor_user_id: UUID | None, action: str,
                           entity_type: str, entity_id: UUID | None,
                           metadata: dict[str, object]) -> None:
        session.add(AuditEvent(workspace_id=workspace_id, actor_user_id=actor_user_id,
                               action=action, entity_type=entity_type,
                               entity_id=entity_id, metadata_json=metadata))

- [ ] **Step 4: Verify migration and request context**

Run: `cd apps/api; uv run alembic upgrade head; uv run pytest tests/integration/test_migrations.py tests/test_request_context.py -v`

Expected: tests PASS and logs contain the request ID.

- [ ] **Step 5: Commit**

Run: `git add apps/api; git commit -m "feat: add database foundation and request observability"`

### Task 3: Implement password authentication, sessions, and optional Google OAuth

**Files:**
- Create: `apps/api/app/models/user.py`, `apps/api/app/models/session.py`, `apps/api/app/schemas/auth.py`
- Create: `apps/api/app/core/security.py`, `apps/api/app/services/auth_service.py`, `apps/api/app/services/google_oauth.py`
- Create: `apps/api/app/api/v1/auth.py`, `apps/api/alembic/versions/0002_auth.py`
- Test: `apps/api/tests/api/test_auth.py`

**Interfaces:** Produces `register_user(email, password) -> User`, `authenticate_password(email, password) -> User | None`, `create_session(user_id, user_agent, ip_hash) -> SessionToken`, and `require_user() -> User`. Google routes are `/api/v1/auth/google/start` and `/api/v1/auth/google/callback`.

- [ ] **Step 1: Write failing auth and Google-configuration tests**

    def test_password_hash_is_argon2_and_never_returned(client):
        created = client.post("/api/v1/auth/register", json={"email": "a@example.com", "password": "correct horse battery staple"})
        assert created.status_code == 201
        assert "password_hash" not in created.json()

    def test_google_start_without_credentials_is_explicit(client):
        response = client.get("/api/v1/auth/google/start")
        assert response.status_code == 503
        assert response.json()["code"] == "google_oauth_unconfigured"

- [ ] **Step 2: Verify the tests fail**

Run: `cd apps/api; uv run pytest tests/api/test_auth.py -v`

Expected: FAIL because auth routes and models are absent.

- [ ] **Step 3: Implement Argon2id, opaque sessions, CSRF, rate limits, and OIDC PKCE**

    def hash_password(password: str) -> str:
        return PasswordHasher().hash(password)

    def verify_password(password: str, encoded_hash: str) -> bool:
        try:
            return PasswordHasher().verify(encoded_hash, password)
        except VerifyMismatchError:
            return False

- [ ] **Step 4: Verify secure session behavior**

Run: `cd apps/api; uv run pytest tests/api/test_auth.py -v`

Expected: PASS for registration, login, logout, session rotation, CSRF rejection, rate limit, and unconfigured Google OAuth.

- [ ] **Step 5: Commit**

Run: `git add apps/api; git commit -m "feat: add secure password and Google authentication"`

### Task 4: Add workspaces, authorisation, and exporter profile versions

**Files:**
- Create: `apps/api/app/models/workspace.py`, `apps/api/app/models/exporter_profile.py`
- Create: `apps/api/app/schemas/workspaces.py`, `apps/api/app/schemas/exporter_profiles.py`
- Create: `apps/api/app/services/workspace_service.py`, `apps/api/app/api/v1/workspaces.py`, `apps/api/app/api/v1/exporter_profiles.py`
- Create: `apps/api/alembic/versions/0003_workspaces.py`
- Test: `apps/api/tests/api/test_workspace_authorization.py`, `apps/api/tests/api/test_exporter_profiles.py`

**Interfaces:** Produces `require_workspace_member(workspace_id: UUID, minimum_role: WorkspaceRole) -> WorkspaceMembership` and `create_profile_version(workspace_id: UUID, payload: ExporterProfileWrite, actor_id: UUID) -> ExporterProfileVersion`.

- [ ] **Step 1: Write failing workspace isolation and profile version tests**

    def test_user_cannot_read_another_workspace(client, other_workspace):
        response = client.get(f"/api/v1/workspaces/{other_workspace.id}")
        assert response.status_code in {403, 404}

    def test_profile_update_creates_a_new_version(client, workspace):
        first = client.post(f"/api/v1/workspaces/{workspace.id}/exporter-profile", json=PROFILE)
        second = client.put(f"/api/v1/workspaces/{workspace.id}/exporter-profile", json={**PROFILE, "capacity_tons": 200})
        assert second.json()["version"] == first.json()["version"] + 1

- [ ] **Step 2: Verify the tests fail**

Run: `cd apps/api; uv run pytest tests/api/test_workspace_authorization.py tests/api/test_exporter_profiles.py -v`

Expected: FAIL because workspace/profile routes are absent.

- [ ] **Step 3: Implement ownership checks and append-only profile versions**

    class WorkspaceRole(StrEnum):
        OWNER = "owner"
        EDITOR = "editor"
        VIEWER = "viewer"

    def require_workspace_member(workspace_id: UUID, minimum_role: WorkspaceRole) -> WorkspaceMembership:
        membership = membership_repository.find(current_user_id(), workspace_id)
        if membership is None or not membership.role.allows(minimum_role):
            raise HTTPException(status_code=404, detail="Workspace not found")
        return membership

- [ ] **Step 4: Verify ownership and profile history**

Run: `cd apps/api; uv run pytest tests/api/test_workspace_authorization.py tests/api/test_exporter_profiles.py -v`

Expected: PASS; cross-workspace access is denied and updates append audit/profile records.

- [ ] **Step 5: Commit**

Run: `git add apps/api; git commit -m "feat: add workspaces and exporter profiles"`

### Task 5: Build frontend auth, workspace shell, and onboarding

**Files:**
- Create: `apps/web/app/(public)/sign-in/page.tsx`, `apps/web/app/(public)/register/page.tsx`
- Create: `apps/web/app/(workspace)/layout.tsx`, `apps/web/app/(workspace)/onboarding/page.tsx`
- Create: `apps/web/components/auth/auth-form.tsx`, `apps/web/components/workspace/sidebar.tsx`, `apps/web/components/onboarding/exporter-profile-form.tsx`
- Create: `apps/web/lib/api.ts`, `apps/web/lib/session.ts`, `apps/web/lib/schemas.ts`
- Test: `apps/web/tests/auth-form.test.tsx`, `apps/web/tests/onboarding.spec.ts`

**Interfaces:** Consumes auth/profile APIs and produces protected routes under `/workspace/[workspaceId]`; unauthenticated users redirect to `/sign-in`.

- [ ] **Step 1: Write failing registration and onboarding tests**

    it("submits an email/password registration request", async () => {
      render(<AuthForm mode="register" />)
      await userEvent.type(screen.getByLabelText(/email/i), "exporter@example.com")
      await userEvent.type(screen.getByLabelText(/^password/i), "correct horse battery staple")
      await userEvent.click(screen.getByRole("button", { name: /create account/i }))
      expect(mockRegister).toHaveBeenCalledWith({ email: "exporter@example.com", password: "correct horse battery staple" })
    })

    test("new user completes exporter onboarding", async ({ page }) => {
      await page.goto("/register")
      await register(page)
      await expect(page.getByRole("heading", { name: /tell us about your exports/i })).toBeVisible()
    })

- [ ] **Step 2: Verify tests fail**

Run: `cd apps/web; pnpm test -- auth-form.test.tsx; pnpm playwright test tests/onboarding.spec.ts`

Expected: FAIL because routes and components are absent.

- [ ] **Step 3: Implement forms, protected layout, OAuth button state, and profile wizard**

    export function GoogleSignInButton({ configured }: { configured: boolean }) {
      return <Button disabled={!configured} onClick={() => window.location.assign("/api/v1/auth/google/start")}>Continue with Google</Button>
    }

- [ ] **Step 4: Verify browser journey**

Run: `cd apps/web; pnpm test -- auth-form.test.tsx; pnpm playwright test tests/onboarding.spec.ts`

Expected: PASS; a user reaches onboarding, submits a profile, and unconfigured Google OAuth explains its state.

- [ ] **Step 5: Commit**

Run: `git add apps/web; git commit -m "feat: add workspace authentication and onboarding UI"`

### Task 6: Create public-trade data package, market scores, and seed snapshots

**Files:**
- Create: `packages/trade-data/src/foretrade_trade_data/models.py`, `normalization.py`, `seed.py`, `fixtures/india_market_metrics.csv`
- Create: `apps/api/app/models/trade_data.py`, `apps/api/app/services/market_service.py`, `apps/api/app/api/v1/markets.py`
- Create: `apps/api/alembic/versions/0004_trade_data.py`
- Modify: `infra/scripts/seed-local.ps1`
- Test: `packages/trade-data/tests/test_normalization.py`, `apps/api/tests/api/test_markets.py`

**Interfaces:** Produces `normalize_market_metric(row) -> TradeMarketMetricInput`, `calculate_market_score(metric, preferences) -> MarketScore`, `GET /api/v1/markets?hs_code=...`, and `GET /api/v1/markets/{country_code}` with provenance.

- [ ] **Step 1: Write failing provenance and missing-data tests**

    def test_market_score_marks_missing_growth_as_low_confidence():
        score = calculate_market_score(metric_with(growth_pct=None), preferences())
        assert score.confidence == "low"
        assert "growth_pct" in score.missing_inputs

    def test_market_response_includes_source_period_and_version(client):
        row = client.get("/api/v1/markets?hs_code=6109").json()["items"][0]
        assert {"source_name", "source_period", "dataset_version", "refreshed_at"} <= row.keys()

- [ ] **Step 2: Verify tests fail**

Run: `cd packages/trade-data; uv run pytest tests/test_normalization.py -v; cd ../../apps/api; uv run pytest tests/api/test_markets.py -v`

Expected: FAIL because snapshot models and market service are absent.

- [ ] **Step 3: Implement normalized snapshots and deterministic scores**

    def calculate_market_score(metric: TradeMarketMetric, preferences: ExporterPreferences) -> MarketScore:
        values = [metric.export_value_usd, metric.growth_pct, metric.diversification_score, preferences.fit(metric.country_code)]
        names = ("export_value_usd", "growth_pct", "diversification_score", "preference_fit")
        missing = [name for name, value in zip(names, values) if value is None]
        return MarketScore(value=round(weighted_available_score(values, (0.40, 0.30, 0.15, 0.15)), 1), confidence=confidence_from_missing(missing), missing_inputs=missing)

- [ ] **Step 4: Verify repeatable seed ingestion**

Run: `powershell -ExecutionPolicy Bypass -File infra/scripts/seed-local.ps1; powershell -ExecutionPolicy Bypass -File infra/scripts/seed-local.ps1; cd apps/api; uv run pytest tests/api/test_markets.py -v`

Expected: repeated seeding does not duplicate rows; test PASS shows source fields.

- [ ] **Step 5: Commit**

Run: `git add packages/trade-data apps/api infra/scripts; git commit -m "feat: add sourced India market data snapshots"`

### Task 7: Deliver Market Explorer and private market watchlists

**Files:**
- Create: `apps/api/app/models/market_watchlist.py`, `apps/api/app/api/v1/market_watchlists.py`
- Create: `apps/web/app/(workspace)/workspace/[workspaceId]/markets/page.tsx`, `apps/web/app/(workspace)/workspace/[workspaceId]/markets/[countryCode]/page.tsx`
- Create: `apps/web/components/markets/market-table.tsx`, `market-score-card.tsx`, `market-compare.tsx`, `watchlist-button.tsx`
- Test: `apps/api/tests/api/test_market_watchlists.py`, `apps/web/tests/markets.spec.ts`

**Interfaces:** Consumes market APIs and produces `POST /api/v1/workspaces/{workspace_id}/market-watchlist` plus country compare/watchlist UI.

- [ ] **Step 1: Write failing watchlist ownership and source-display tests**

    def test_watchlist_is_private_to_workspace(client, workspace, other_workspace):
        client.post(f"/api/v1/workspaces/{workspace.id}/market-watchlist", json={"country_code": "AE", "hs_code": "6109"})
        assert client.get(f"/api/v1/workspaces/{other_workspace.id}/market-watchlist").json()["items"] == []

    test("market table exposes source period", async ({ page }) => {
      await page.goto("/workspace/demo/markets?hsCode=6109")
      await expect(page.getByText(/source period/i).first()).toBeVisible()
    })

- [ ] **Step 2: Verify tests fail**

Run: `cd apps/api; uv run pytest tests/api/test_market_watchlists.py -v; cd ../web; pnpm playwright test tests/markets.spec.ts`

Expected: FAIL because watchlist and Explorer views are absent.

- [ ] **Step 3: Implement watchlist API and Explorer UI**

    <MarketScoreCard score={market.score} confidence={market.confidence} missingInputs={market.missingInputs} provenance={market.provenance} />

- [ ] **Step 4: Verify watchlist isolation and Market Explorer**

Run: `cd apps/api; uv run pytest tests/api/test_market_watchlists.py -v; cd ../web; pnpm playwright test tests/markets.spec.ts`

Expected: PASS; compare/save actions work and every metric shows source/year/freshness.

- [ ] **Step 5: Commit**

Run: `git add apps/api apps/web; git commit -m "feat: add market explorer and watchlists"`

### Task 8: Build durable upload and job infrastructure

**Files:**
- Create: `apps/api/app/models/background_job.py`, `import_file.py`, `import_job.py`
- Create: `apps/api/app/services/object_storage.py`, `job_service.py`, `apps/api/app/workers/broker.py`
- Create: `apps/api/app/api/v1/imports.py`, `apps/api/alembic/versions/0005_import_jobs.py`
- Test: `apps/api/tests/api/test_import_uploads.py`

**Interfaces:** Produces `create_import_job(workspace_id, uploaded_file, actor_id) -> ImportJob`, `enqueue(job_id, task_name) -> None`, and `GET /api/v1/jobs/{job_id}`.

- [ ] **Step 1: Write failing file-validation and job-isolation tests**

    def test_rejects_non_tabular_upload(client, workspace):
        response = client.post(f"/api/v1/workspaces/{workspace.id}/imports", files={"file": ("payload.exe", b"MZ", "application/octet-stream")})
        assert response.status_code == 422

    def test_other_workspace_cannot_read_import_job(client, import_job):
        response = client.get(f"/api/v1/jobs/{import_job.id}")
        assert response.status_code in {403, 404}

- [ ] **Step 2: Verify tests fail**

Run: `cd apps/api; uv run pytest tests/api/test_import_uploads.py -v`

Expected: FAIL because file/job services are absent.

- [ ] **Step 3: Implement private object keys, file checks, durable jobs, and worker broker**

    def object_key(workspace_id: UUID, import_id: UUID, filename: str) -> str:
        return f"workspaces/{workspace_id}/imports/{import_id}/{uuid4()}-{safe_filename(filename)}"

- [ ] **Step 4: Verify upload behavior and job status**

Run: `cd apps/api; uv run pytest tests/api/test_import_uploads.py -v`

Expected: PASS; CSV/XLSX creates queued jobs, invalid files fail safely, and jobs remain private.

- [ ] **Step 5: Commit**

Run: `git add apps/api infra/compose; git commit -m "feat: add private import uploads and job tracking"`

### Task 9: Implement parsing, mapping, validation, and preview

**Files:**
- Create: `apps/api/app/models/import_row.py`, `import_mapping.py`, `import_issue.py`
- Create: `apps/api/app/schemas/imports.py`, `apps/api/app/services/import_parser.py`, `import_validation.py`, `import_preview.py`
- Create: `apps/api/app/workers/import_tasks.py`, `apps/api/alembic/versions/0006_import_rows.py`
- Test: `apps/api/tests/services/test_import_validation.py`, `apps/api/tests/api/test_import_preview.py`

**Interfaces:** Produces `parse_tabular_file(storage_key) -> ParsedTable`, `validate_row(row_number, raw, mapping) -> ValidationResult`, `POST /api/v1/imports/{import_id}/mapping`, and `GET /api/v1/imports/{import_id}/preview`.

- [ ] **Step 1: Write failing malformed-import tests**

    def test_preview_reports_blank_required_fields_and_formula_cells():
        result = validate_row(4, {"Company": "", "Country": "India", "Product": "=NOW()"}, required_mapping())
        assert {issue.code for issue in result.issues} == {"required_company_name", "formula_cell_not_allowed"}

    def test_preview_does_not_commit_company_records(client, prepared_import):
        assert client.get(f"/api/v1/imports/{prepared_import.id}/preview").status_code == 200
        assert company_count(prepared_import.workspace_id) == 0

- [ ] **Step 2: Verify tests fail**

Run: `cd apps/api; uv run pytest tests/services/test_import_validation.py tests/api/test_import_preview.py -v`

Expected: FAIL because parser/validation/preview code is absent.

- [ ] **Step 3: Implement canonical parser and validation rules**

    CANONICAL_FIELDS = {"company_name", "country", "product_or_industry", "website", "contact_name", "email", "phone", "source_url", "notes", "tags"}

    def validate_row(row_number: int, raw: dict[str, object], mapping: ImportMapping) -> ValidationResult:
        canonical = map_row(raw, mapping)
        issues = required_field_issues(canonical) + formula_cell_issues(raw) + date_and_email_issues(canonical)
        return ValidationResult(row_number=row_number, canonical=canonical, issues=issues)

- [ ] **Step 4: Verify parser safety and preview-only behavior**

Run: `cd apps/api; uv run pytest tests/services/test_import_validation.py tests/api/test_import_preview.py -v`

Expected: PASS for UTF-8/Excel input, blanks, formulas, invalid dates, unmapped columns, and no preview commit.

- [ ] **Step 5: Commit**

Run: `git add apps/api; git commit -m "feat: add validated tabular import previews"`

### Task 10: Commit imports, preserve provenance, and create the company catalogue

**Files:**
- Create: `apps/api/app/models/company.py`, `company_source.py`, `company_tag.py`
- Create: `apps/api/app/services/company_service.py`, `deduplication.py`, `apps/api/app/api/v1/companies.py`
- Create: `apps/api/alembic/versions/0007_companies.py`
- Modify: `apps/api/app/api/v1/imports.py`
- Test: `apps/api/tests/services/test_deduplication.py`, `apps/api/tests/api/test_import_commit.py`, `apps/api/tests/api/test_companies.py`

**Interfaces:** Produces `commit_import(import_id, idempotency_key, actor_id) -> ImportCommitResult`, `find_duplicate_candidates(workspace_id, canonical) -> list[DuplicateCandidate]`, and paginated `GET /api/v1/workspaces/{workspace_id}/companies`.

- [ ] **Step 1: Write failing idempotency, provenance, and duplicate tests**

    def test_repeated_commit_key_creates_companies_once(client, ready_import):
        first = client.post(f"/api/v1/imports/{ready_import.id}/commit", headers={"Idempotency-Key": "same-key"})
        second = client.post(f"/api/v1/imports/{ready_import.id}/commit", headers={"Idempotency-Key": "same-key"})
        assert first.json()["created_count"] == second.json()["created_count"]
        assert company_count(ready_import.workspace_id) == first.json()["created_count"]

    def test_company_retains_source_row_and_unverified_email(client, imported_company):
        company = client.get(f"/api/v1/companies/{imported_company.id}").json()
        assert company["sources"][0]["row_number"] == 2
        assert company["email_verification_state"] == "unverified"

- [ ] **Step 2: Verify tests fail**

Run: `cd apps/api; uv run pytest tests/services/test_deduplication.py tests/api/test_import_commit.py tests/api/test_companies.py -v`

Expected: FAIL because company and commit services are absent.

- [ ] **Step 3: Implement idempotent commit, duplicate policy, provenance, archive operation, and pagination**

    def commit_import(import_id: UUID, idempotency_key: str, actor_id: UUID) -> ImportCommitResult:
        existing = idempotency_repository.find(actor_id, "import_commit", idempotency_key)
        if existing:
            return existing.response_payload
        with transactional_session() as session:
            result = company_importer.commit_valid_rows(session, import_id, actor_id)
            idempotency_repository.store(session, actor_id, "import_commit", idempotency_key, result)
            return result

- [ ] **Step 4: Verify commit invariants**

Run: `cd apps/api; uv run pytest tests/services/test_deduplication.py tests/api/test_import_commit.py tests/api/test_companies.py -v`

Expected: PASS; duplicate candidates are visible, repeated commits do not duplicate, and catalogue data stays workspace-private.

- [ ] **Step 5: Commit**

Run: `git add apps/api; git commit -m "feat: commit sourced company imports"`

### Task 11: Implement deterministic opportunity scoring

**Files:**
- Create: `packages/scoring/src/foretrade_scoring/models.py`, `eligibility.py`, `calculator.py`, `explanations.py`
- Create: `apps/api/app/models/scoring_preset.py`, `opportunity_score.py`
- Create: `apps/api/app/services/opportunity_service.py`, `apps/api/app/workers/scoring_tasks.py`, `apps/api/app/api/v1/opportunities.py`
- Test: `packages/scoring/tests/test_calculator.py`, `apps/api/tests/api/test_opportunities.py`

**Interfaces:** Produces `evaluate_opportunity(profile, company, market, preset) -> OpportunityEvaluation`, `POST /api/v1/companies/{company_id}/rescore -> {"job_id": UUID}`, and `GET /api/v1/opportunities`.

- [ ] **Step 1: Write failing score-explanation and ineligibility tests**

    def test_unrelated_product_is_ineligible():
        result = evaluate_opportunity(textile_exporter(), chemicals_company(), None, default_preset())
        assert result.eligible is False
        assert result.ineligibility_reasons == ["product_mismatch"]

    def test_missing_capacity_lowers_confidence_without_favourable_default():
        result = evaluate_opportunity(profile_without_capacity(), compatible_company(), None, default_preset())
        assert result.confidence == "low"
        assert "exporter_capacity" in result.missing_inputs

- [ ] **Step 2: Verify tests fail**

Run: `cd packages/scoring; uv run pytest tests/test_calculator.py -v; cd ../../apps/api; uv run pytest tests/api/test_opportunities.py -v`

Expected: FAIL because scoring package and opportunity API are absent.

- [ ] **Step 3: Implement immutable score snapshots and explanations**

    def evaluate_opportunity(profile: ExporterProfile, company: CompanyInput,
                             market: MarketContext | None, preset: ScoringPreset) -> OpportunityEvaluation:
        eligibility = product_eligibility(profile.products, company.products)
        if not eligibility.allowed:
            return OpportunityEvaluation.ineligible(eligibility.reason)
        contributions = calculate_contributions(profile, company, market, preset)
        return OpportunityEvaluation.from_contributions(contributions, profile.version, preset.version)

- [ ] **Step 4: Verify score rules and rescore idempotency**

Run: `cd packages/scoring; uv run pytest tests/test_calculator.py -v; cd ../../apps/api; uv run pytest tests/api/test_opportunities.py -v`

Expected: PASS; every score has contributions, source inputs, confidence, missing requirements, and profile/preset versions.

- [ ] **Step 5: Commit**

Run: `git add packages/scoring apps/api; git commit -m "feat: add explainable opportunity scoring"`

### Task 12: Build import wizard and company catalogue frontend

**Files:**
- Create: `apps/web/app/(workspace)/workspace/[workspaceId]/imports/new/page.tsx`, `imports/[importId]/page.tsx`, `companies/page.tsx`, `companies/[companyId]/page.tsx`
- Create: `apps/web/components/imports/upload-step.tsx`, `mapping-step.tsx`, `validation-report.tsx`, `commit-step.tsx`
- Create: `apps/web/components/companies/company-table.tsx`, `company-filters.tsx`, `company-detail.tsx`, `score-explanation.tsx`
- Test: `apps/web/tests/import-wizard.spec.ts`, `apps/web/tests/company-catalogue.spec.ts`

**Interfaces:** Consumes import upload/mapping/preview/commit endpoints and paginated company/opportunity endpoints. Produces a four-step importer plus private catalogue with explanations.

- [ ] **Step 1: Write failing mapping, validation, retry, and score-transparency tests**

    test("validation failure is shown before import commit", async ({ page }) => {
      await page.goto("/workspace/demo/imports/new")
      await page.setInputFiles('input[type="file"]', "fixtures/invalid-companies.csv")
      await expect(page.getByText(/company name is required/i)).toBeVisible()
      await expect(page.getByRole("button", { name: /commit import/i })).toBeDisabled()
    })

    test("company score shows inputs and missing requirements", async ({ page }) => {
      await page.goto("/workspace/demo/companies/company-1")
      await expect(page.getByRole("heading", { name: /why this score/i })).toBeVisible()
      await expect(page.getByText(/data confidence/i)).toBeVisible()
    })

- [ ] **Step 2: Verify tests fail**

Run: `cd apps/web; pnpm playwright test tests/import-wizard.spec.ts tests/company-catalogue.spec.ts`

Expected: FAIL because pages/components are absent.

- [ ] **Step 3: Implement upload/mapping/preview/commit and company views**

    <ScoreExplanation contributions={opportunity.contributions} missingInputs={opportunity.missingInputs}
      confidence={opportunity.confidence} calculatedAt={opportunity.calculatedAt} />

- [ ] **Step 4: Verify responsive browser workflows**

Run: `cd apps/web; pnpm playwright test tests/import-wizard.spec.ts tests/company-catalogue.spec.ts`

Expected: PASS; invalid rows block commit, retries do not duplicate, and every displayed score is understandable.

- [ ] **Step 5: Commit**

Run: `git add apps/web; git commit -m "feat: add import wizard and company intelligence UI"`

### Task 13: Add leads, actual activities, reminders, and outreach drafts

**Files:**
- Create: `apps/api/app/models/lead.py`, `lead_event.py`, `reminder.py`, `outreach_draft.py`
- Create: `apps/api/app/schemas/leads.py`, `apps/api/app/services/lead_service.py`, `outreach_service.py`
- Create: `apps/api/app/api/v1/leads.py`, `apps/api/app/api/v1/outreach_drafts.py`, `apps/api/alembic/versions/0008_leads.py`
- Test: `apps/api/tests/services/test_lead_transitions.py`, `apps/api/tests/api/test_outreach_drafts.py`

**Interfaces:** Produces `record_lead_event(lead_id, event, actor_id) -> LeadEvent`, `change_stage(lead_id, target, event_id, actor_id) -> Lead`, and `create_outreach_draft(lead_id, template_key, actor_id) -> OutreachDraft`.

- [ ] **Step 1: Write failing event-gating and draft-truthfulness tests**

    def test_cannot_mark_replied_without_reply_received_event(client, lead):
        response = client.post(f"/api/v1/leads/{lead.id}/stage", json={"target": "replied", "event_id": str(uuid4())})
        assert response.status_code == 422
        assert response.json()["code"] == "required_event_missing"

    def test_exported_draft_is_not_a_sent_message(client, lead):
        draft = client.post(f"/api/v1/leads/{lead.id}/outreach-drafts", json={"template_key": "intro"}).json()
        client.post(f"/api/v1/outreach-drafts/{draft['id']}/export")
        assert client.get(f"/api/v1/outreach-drafts/{draft['id']}").json()["delivery_state"] == "not_sent"

- [ ] **Step 2: Verify tests fail**

Run: `cd apps/api; uv run pytest tests/services/test_lead_transitions.py tests/api/test_outreach_drafts.py -v`

Expected: FAIL because lead/event/draft services are absent.

- [ ] **Step 3: Implement append-only events, stage policy, reminders, and deterministic drafts**

    REQUIRED_EVENT_FOR_STAGE = {LeadStage.REPLIED: LeadEventType.REPLY_RECEIVED,
                                LeadStage.MEETING: LeadEventType.MEETING}

    def change_stage(lead_id: UUID, target: LeadStage, event_id: UUID, actor_id: UUID) -> Lead:
        event = lead_event_repository.require_owned(event_id, lead_id, actor_id)
        required = REQUIRED_EVENT_FOR_STAGE.get(target)
        if required and event.event_type != required:
            raise DomainError("required_event_missing")
        return lead_repository.transition(lead_id, target, actor_id, event_id)

- [ ] **Step 4: Verify timeline and stage invariants**

Run: `cd apps/api; uv run pytest tests/services/test_lead_transitions.py tests/api/test_outreach_drafts.py -v`

Expected: PASS; no simulated activity exists, guarded stages require matching actual events, and exports remain not sent.

- [ ] **Step 5: Commit**

Run: `git add apps/api; git commit -m "feat: add event-based lead pipeline and outreach drafts"`

### Task 14: Deliver lead workspace and outreach frontend

**Files:**
- Create: `apps/web/app/(workspace)/workspace/[workspaceId]/leads/page.tsx`, `leads/[leadId]/page.tsx`
- Create: `apps/web/components/leads/lead-board.tsx`, `lead-timeline.tsx`, `stage-dialog.tsx`, `activity-form.tsx`, `reminder-form.tsx`
- Create: `apps/web/components/outreach/draft-editor.tsx`, `draft-export.tsx`
- Test: `apps/web/tests/leads.spec.ts`, `apps/web/tests/outreach.spec.ts`

**Interfaces:** Consumes lead/event/reminder/outreach APIs from Task 13 and produces a real-event lead board/detail flow with editable drafts.

- [ ] **Step 1: Write failing stage-guard and no-fake-send UI tests**

    test("replied stage requires a recorded received reply", async ({ page }) => {
      await page.goto("/workspace/demo/leads/lead-1")
      await page.getByRole("button", { name: /change stage/i }).click()
      await page.getByText("Replied").click()
      await expect(page.getByText(/record a reply received event first/i)).toBeVisible()
    })

    test("exporting a draft never displays a sent confirmation", async ({ page }) => {
      await page.goto("/workspace/demo/leads/lead-1")
      await page.getByRole("button", { name: /export draft/i }).click()
      await expect(page.getByText(/draft exported.*not sent/i)).toBeVisible()
    })

- [ ] **Step 2: Verify tests fail**

Run: `cd apps/web; pnpm playwright test tests/leads.spec.ts tests/outreach.spec.ts`

Expected: FAIL because lead/outreach pages are absent.

- [ ] **Step 3: Implement timeline, guarded stage dialog, reminder UI, draft editor, and truthful export message**

    <DraftExport draft={draft} onExport={() => exportDraft(draft.id)} confirmation="Draft exported. It has not been sent." />

- [ ] **Step 4: Verify lead workflow**

Run: `cd apps/web; pnpm playwright test tests/leads.spec.ts tests/outreach.spec.ts`

Expected: PASS; activities persist, stage changes are guarded, and draft export states are truthful.

- [ ] **Step 5: Commit**

Run: `git add apps/web; git commit -m "feat: add lead workspace and truthful outreach UI"`

### Task 15: Add analytics, saved views, exports, and audit surfaces

**Files:**
- Create: `apps/api/app/models/saved_view.py`, `apps/api/app/services/analytics_service.py`, `export_service.py`
- Create: `apps/api/app/api/v1/analytics.py`, `exports.py`, `saved_views.py`
- Create: `apps/web/app/(workspace)/workspace/[workspaceId]/analytics/page.tsx`
- Create: `apps/web/components/analytics/import-quality.tsx`, `pipeline-funnel.tsx`, `score-distribution.tsx`, `empty-state.tsx`
- Test: `apps/api/tests/api/test_analytics.py`, `apps/web/tests/analytics.spec.ts`

**Interfaces:** Produces `get_workspace_analytics(workspace_id, period) -> WorkspaceAnalytics`, saved views, and `POST /api/v1/workspaces/{workspace_id}/exports/companies -> {"job_id": UUID}`.

- [ ] **Step 1: Write failing no-data and event-only funnel tests**

    def test_funnel_counts_only_stored_stage_transitions(client, workspace):
        data = client.get(f"/api/v1/workspaces/{workspace.id}/analytics").json()
        assert data["pipeline"]["replied"] == 0

    def test_company_export_contains_provenance_columns(client, workspace):
        job = client.post(f"/api/v1/workspaces/{workspace.id}/exports/companies").json()
        assert {"source_name", "source_row_number", "email_verification_state"} <= set(wait_for_export_headers(job["job_id"]))

- [ ] **Step 2: Verify tests fail**

Run: `cd apps/api; uv run pytest tests/api/test_analytics.py -v; cd ../web; pnpm playwright test tests/analytics.spec.ts`

Expected: FAIL because analytics/export surfaces are absent.

- [ ] **Step 3: Implement aggregates, saved filters, CSV exports, and honest empty states**

    def get_workspace_analytics(workspace_id: UUID, period: DateRange) -> WorkspaceAnalytics:
        transitions = lead_event_repository.transitions(workspace_id, period)
        return WorkspaceAnalytics(import_quality=import_repository.summary(workspace_id, period),
                                  pipeline=funnel_from_transitions(transitions),
                                  score_distribution=score_repository.distribution(workspace_id, period))

- [ ] **Step 4: Verify analytics and exports**

Run: `cd apps/api; uv run pytest tests/api/test_analytics.py -v; cd ../web; pnpm playwright test tests/analytics.spec.ts`

Expected: PASS; empty workspaces show guidance, no fictional activity appears, and exports retain provenance.

- [ ] **Step 5: Commit**

Run: `git add apps/api apps/web; git commit -m "feat: add workspace analytics and exports"`

### Task 16: Add offline ML evaluation foundation without product-model claims

**Files:**
- Create: `packages/ml/src/foretrade_ml/dataset.py`, `features.py`, `evaluation.py`, `registry.py`
- Create: `packages/ml/tests/test_temporal_split.py`, `test_baseline_comparison.py`
- Create: `docs/ml-evaluation.md`, `docs/data-contracts.md`

**Interfaces:** Produces `build_training_dataset(events) -> TrainingDataset`, `temporal_split(dataset, cutoff) -> DatasetSplit`, and `evaluate_against_baseline(split) -> EvaluationReport`. It produces no production score endpoint or performance claim.

- [ ] **Step 1: Write failing temporal-leakage and baseline tests**

    def test_temporal_split_never_places_future_events_in_training():
        split = temporal_split(dataset_with_dates(), date(2026, 1, 1))
        assert max(split.train.event_dates) < date(2026, 1, 1)
        assert min(split.test.event_dates) >= date(2026, 1, 1)

    def test_report_marks_insufficient_data_without_outcome_events():
        report = evaluate_against_baseline(empty_outcome_split())
        assert report.status == "insufficient_outcomes"

- [ ] **Step 2: Verify tests fail**

Run: `cd packages/ml; uv run pytest tests/test_temporal_split.py tests/test_baseline_comparison.py -v`

Expected: FAIL because offline ML package is absent.

- [ ] **Step 3: Implement feature/data registry and evidence-based evaluation**

    def evaluate_against_baseline(split: DatasetSplit) -> EvaluationReport:
        if split.train.outcome_count < 100 or split.test.outcome_count < 30:
            return EvaluationReport(status="insufficient_outcomes", metrics={})
        return EvaluationReport(status="evaluated", metrics=compare_models(split))

- [ ] **Step 4: Verify ML remains offline and evidence-based**

Run: `cd packages/ml; uv run pytest tests/test_temporal_split.py tests/test_baseline_comparison.py -v`

Expected: PASS; future events never leak into training and insufficient outcomes create no model claim.

- [ ] **Step 5: Commit**

Run: `git add packages/ml docs/ml-evaluation.md docs/data-contracts.md; git commit -m "feat: add offline ML evaluation foundation"`

### Task 17: Add release quality gates, demo seed, operations, and recruiter flow

**Files:**
- Create: `.github/workflows/ci.yml`, `docs/architecture.md`, `docs/local-development.md`, `docs/demo-guide.md`, `docs/release-checklist.md`
- Create: `infra/scripts/reset-demo.ps1`, `infra/scripts/backup-postgres.ps1`, `infra/scripts/restore-postgres.ps1`
- Create: `apps/api/tests/e2e/test_primary_journey.py`, `apps/web/tests/primary-journey.spec.ts`
- Modify: `README.md`, `.env.example`, `infra/compose/docker-compose.yml`

**Interfaces:** Produces `reset-demo.ps1` that recreates only the local demo workspace/public snapshot, plus CI checks for formatting, typing, migrations, tests, Playwright, and Compose build.

- [ ] **Step 1: Write failing clean-environment and primary-journey tests**

    def test_primary_api_journey(client):
        user = register_and_onboard(client)
        imported = import_valid_company_list(client, user.workspace_id)
        lead = create_lead_from_company(client, imported.company_id)
        record_contact_attempt(client, lead.id)
        assert client.get(f"/api/v1/leads/{lead.id}").json()["stage"] == "contacted"

    test("exporter can onboard, import, score, create a lead, and reload", async ({ page }) => {
      await completeOnboarding(page)
      await importCompanies(page, "fixtures/valid-companies.csv")
      await createLead(page)
      await page.reload()
      await expect(page.getByText(/new lead/i)).toBeVisible()
    })

- [ ] **Step 2: Verify tests fail until services are integrated**

Run: `cd apps/api; uv run pytest tests/e2e/test_primary_journey.py -v; cd ../web; pnpm playwright test tests/primary-journey.spec.ts`

Expected: FAIL until the complete system and fixture wiring are present.

- [ ] **Step 3: Implement CI, reset/backup/restore scripts, demo isolation, release docs, and fixture data**

    jobs:
      verify:
        steps:
          - run: docker compose -f infra/compose/docker-compose.yml build
          - run: cd apps/api && uv run ruff check . && uv run mypy app && uv run pytest
          - run: cd apps/web && pnpm lint && pnpm test && pnpm playwright test

- [ ] **Step 4: Verify a clean release candidate**

Run: `powershell -ExecutionPolicy Bypass -File infra/scripts/reset-demo.ps1; docker compose -f infra/compose/docker-compose.yml up --build -d; cd apps/api; uv run pytest; cd ../web; pnpm lint; pnpm test; pnpm playwright test tests/primary-journey.spec.ts`

Expected: all checks PASS; demo data is labelled; local startup, backup, restore, and primary journey work without paid credentials.

- [ ] **Step 5: Commit**

Run: `git add .github docs infra README.md .env.example apps/api apps/web; git commit -m "chore: add release quality gates and demo operations"`

## Specification coverage review

| Specification area | Tasks |
|---|---|
| Local, zero-cost topology | 1, 2, 8, 17 |
| Secure password/session/Google authentication | 3, 5 |
| Workspaces and exporter profile history | 4, 5 |
| Public trade snapshots and Market Explorer | 6, 7 |
| Upload, mapping, validation, provenance, deduplication | 8, 9, 10, 12 |
| Explainable scoring and snapshots | 11, 12 |
| Lead stages, activities, reminders, truthful outreach | 13, 14 |
| Analytics, saved views, exports, audit surfaces | 2, 10, 15 |
| Offline ML foundation | 16 |
| Tests, CI, demo, documentation, operations | 1, 17 |

## Plan self-review

- **Spec coverage:** Every release feature, non-goal, data requirement, service boundary, API group, security requirement, test requirement, demo requirement, and delivery-day outcome maps to a task above.
- **Placeholder scan:** The plan contains no TBD/TODO marker or unspecific error-handling step. Every task names files, interfaces, test commands, expected results, and a commit boundary.
- **Type consistency:** `workspace_id`, `import_id`, `company_id`, `lead_id`, and `job_id` are UUIDs across routes, services, and workers. Market/opportunity scores expose confidence and missing-input contracts. Stage guards use the Task 13 `LeadEventType`/`LeadStage` interface.
- **Review focus:** Cross-workspace access is tested in Tasks 4, 7, 8, and 10; malformed imports in 9 and 12; incomplete market data in 6 and 7; idempotency in 10 through 12; activity-gated stages in 13 through 15.

## Execution handoff

Execute tasks in order. Tasks 1–5 establish a secure usable application; Tasks 6–12 make market intelligence and imported-company prioritisation real; Tasks 13–15 complete the operational flow; Tasks 16–17 add honest ML foundations and release quality. Do not expose later UI routes before the matching earlier API contract and tests are green.
