# AI Mystery Room Implementation Plan

> **For agentic workers:** Use the host's available task-by-task implementation workflow. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the v1 responsive web game described in `spec.md`, including secure AI-generated investigations, case gameplay, and reveal scoring.

**Architecture:** A React SPA calls an Express JSON API backed by MongoDB. The server owns authentication, ownership checks, public serializers, generation jobs, Gemini calls, generated-image storage, and scoring; the client only consumes public case and evidence payloads until an accusation has been submitted.

**Tech Stack:** Node.js ES modules, Express, Mongoose, Zod, Jest/Supertest, React, Vite, React Router, TanStack Query, Tailwind CSS, Vitest, and the official `@google/genai` SDK.

## Global Constraints

- The case Bible, culprit, suspect hidden fields, and evidence hidden fields never leave the API before the one allowed accusation response.
- Inputs and model outputs use Zod validation. Scenario text is delimited data in prompts, never an instruction source.
- Every case, evidence, note, and accusation route enforces authenticated ownership and returns `404` for non-owners.
- The app supports registered and guest users, uses secure JWT cookies, provides fictional-only messaging, and never exposes server secrets.
- The UI is responsive from 360px, keyboard-operable, high-contrast, and dark detective themed.
- Gemini model identifiers are environment configuration; generation retries bounded failures and never leaves stale cases generating.

---

### Task 1: Foundations and validated API boundary

**Files:**
- Create: `package.json`, `server/package.json`, `server/src/config/*`, `server/src/app.js`, `server/src/server.js`, `server/src/middleware/*`, `server/src/routes/*`, `server/tests/*`
- Create: `client/package.json`, `client/src/*`, `client/vite.config.js`, Tailwind/PostCSS configuration

**Interfaces:**
- Consumes: JSON request bodies at `/api/v1/*`.
- Produces: standard error object `{ error: { code, message } }` and health-safe Express application factory `createApp()`.

- [ ] Add server integration tests for invalid case creation and malformed JSON bodies.
- [ ] Run `npm --workspace server test -- --runTestsByPath tests/cases.validation.test.js`; observe `404` before the case route exists.
- [ ] Add request schemas, validation middleware, safe error middleware, helmet/CORS/body limits, and API route mounting.
- [ ] Re-run the focused test; expect valid `400 VALIDATION_ERROR` without a database connection.
- [ ] Run `npm run lint` and `npm run format:check`; expect clean output.

### Task 2: Authentication, case persistence, and serializers

**Files:**
- Create: `server/src/models/User.js`, `Case.js`, `Evidence.js`, `Accusation.js`, `server/src/controllers/authController.js`, `caseController.js`, `server/src/middleware/auth.js`, `server/src/serializers/publicCase.js`, `publicEvidence.js`
- Test: `server/tests/auth.test.js`, `server/tests/serializers.test.js`, `server/tests/ownership.test.js`

**Interfaces:**
- Consumes: `/auth/register`, `/auth/login`, `/auth/guest`, cookie JWT, Mongoose records.
- Produces: safe user payloads and `toPublicCase(case)`, `toPublicEvidence(evidence)` payloads.

- [ ] Add tests proving register/login/guest cookie behavior, unsolved serializer omission of every hidden value, and non-owner `404`.
- [ ] Run the focused Jest files; observe missing routes/serializers fail assertions.
- [ ] Implement bcrypt/JWT cookie authentication, models with specified indexes/constraints, ownership middleware, and explicit serializers.
- [ ] Re-run focused tests; expect all safe public representations and ownership checks to pass.
- [ ] Run server test suite; expect no database-dependent behavior without the in-memory model seam.

### Task 3: Case lifecycle, notes, accusation, and scoring

**Files:**
- Create: `server/src/services/scoring.js`, `server/src/controllers/accusationController.js`, `server/src/routes/cases.js`, `server/src/routes/accuse.js`
- Test: `server/tests/scoring.test.js`, `server/tests/accusation.test.js`, `server/tests/notes.test.js`

**Interfaces:**
- Consumes: ready case public/hidden records and `{ suspectId, reasoning }`.
- Produces: one stored accusation, immutable case state, score, and reveal payload as specified in §8.5.

- [ ] Test exact Easy/Medium/Hard score totals across 0, 10, and 30-minute solve times; test duplicate accusation `409` and notes max length.
- [ ] Run focused tests; observe failures caused by absent routes/services.
- [ ] Implement linear time bonus, one-accusation uniqueness handling, locked solved case, and reveal mapper.
- [ ] Re-run focused tests; expect correct score/reveal behavior and required conflict status.
- [ ] Run all server tests; expect public serializer leak tests still pass.

### Task 4: AI, storage, moderation, and resilient generation pipeline

**Files:**
- Create: `server/src/services/gemini/client.js`, `prompts/*`, `schemas/*`, `pipeline.js`, `storage.js`, `moderation.js`, `server/src/services/sampleCase.js`
- Test: `server/tests/pipeline.test.js`, `server/tests/moderation.test.js`

**Interfaces:**
- Consumes: a sanitized case request and injected Gemini/storage adapters.
- Produces: ready or failed case state, stored public evidence, hidden evidence metadata, progress updates, and token/image usage.

- [ ] Test an injected valid Gemini sequence yields a ready case with all evidence types; test three invalid Bible outputs yield failed state; test blocked scenario yields `SCENARIO_NOT_ALLOWED`.
- [ ] Run focused tests; observe failed imports or behavior before pipeline implementation.
- [ ] Implement bounded retries/timeouts, Stage 1–5 contracts, concurrency three for independent work, safe image placeholders, sample development adapter, and stale-generation recovery.
- [ ] Re-run focused tests; expect deterministic ready/failed/moderated outcomes.
- [ ] Run all server tests and inspect that no generation endpoint leaks the Case Bible.

### Task 5: Case-room client foundation and authentication flow

**Files:**
- Create: `client/src/api/*`, `context/AuthContext.jsx`, `components/*`, `pages/LandingPage.jsx`, `LoginPage.jsx`, `RegisterPage.jsx`, `GeneratingPage.jsx`, `App.jsx`
- Test: `client/src/pages/LandingPage.test.jsx`, `client/src/components/ScenarioForm.test.jsx`

**Interfaces:**
- Consumes: auth and case endpoints plus `POST /cases` response `{ caseId }`.
- Produces: accessible scenario form, guest/auth access paths, protected routing, and polling generation progress.

- [ ] Test 10/500 character boundaries, difficulty selection, and successful navigation to `/generating/:id` with mocked API responses.
- [ ] Run the focused Vitest files; observe missing component assertions fail.
- [ ] Implement TanStack Query API client, auth context, scenario form, progress stepper polling every two seconds, retry UI for failed status, and loading/error states.
- [ ] Re-run focused tests; expect accessible controls and required navigation behavior.
- [ ] Run `npm --workspace client test` and `npm --workspace client build`; expect passing tests and production bundle.

### Task 6: Evidence-driven Case Room and responsive visual system

**Files:**
- Create: `client/src/components/CaseFilePanel.jsx`, `SuspectGrid.jsx`, `ChatViewer.jsx`, `ImageGallery.jsx`, `CCTVPlayer.jsx`, `Notebook.jsx`, `CaseRoom.jsx`, `client/src/pages/CasePage.jsx`, `client/src/styles/*`
- Test: `client/src/components/ChatViewer.test.jsx`, `CCTVPlayer.test.jsx`, `Notebook.test.jsx`

**Interfaces:**
- Consumes: public case/evidence data and `PATCH /cases/:id/notes`.
- Produces: tabbed desktop case room, mobile bottom navigation, accessible evidence viewers, and debounced saved notes.

- [ ] Test deleted-chat presentation, CCTV play/pause and frame controls, and 1.5 second debounced note save.
- [ ] Run focused Vitest tests; observe absent evidence rendering behavior.
- [ ] Implement the documented dark case-file tokens, evidence modules, metadata/alt text, keyboard tabs/modals, responsive bottom navigation, scanline effect with reduced-motion support, and query errors/retries.
- [ ] Re-run focused tests; expect evidence behaviors and note persistence calls.
- [ ] Capture desktop/mobile case room renders and verify no horizontal overflow, contrast, focus, and evidence metadata visibility.

### Task 7: Accusation and reveal experience

**Files:**
- Create: `client/src/components/AccuseModal.jsx`, `RevealView.jsx`, `client/src/pages/RevealPage.jsx`
- Test: `client/src/components/AccuseModal.test.jsx`, `RevealView.test.jsx`

**Interfaces:**
- Consumes: public suspects, accusation request, reveal payload.
- Produces: irreversible two-step confirmation, reveal-only truth presentation, score breakdown, and replay actions.

- [ ] Test that an accusation cannot send without a selected suspect and 20-character reasoning; test confirmation invokes the endpoint once; test reveal content renders from the response.
- [ ] Run focused tests; observe current missing behavior.
- [ ] Implement modal focus trapping, submission state, conflict error handling, reveal timeline/evidence sections, and new-case/same-scenario actions.
- [ ] Re-run focused tests; expect correct client API calls and reveal rendering.
- [ ] Run client tests/build and inspect `/case/:id/reveal` at 375px and 1280px.

### Task 8: Operational hardening and handoff

**Files:**
- Create: `README.md`, ESLint configuration, optional `server/src/jobs/recoverGeneratingCases.js`
- Modify: server/client configs and `.env.example` files
- Test: all existing backend/frontend suites

**Interfaces:**
- Consumes: production environment variables and application startup.
- Produces: documented local setup, configured lint/format behavior, scoped upload serving, log entries with `caseId`, and startup recovery.

- [ ] Add tests for failed-case regeneration authorization and stale generating case recovery.
- [ ] Run focused tests; observe missing recovery/regenerate behavior.
- [ ] Implement global and generation-specific limits, cache-aware scoped upload serving, structured logging, recovery startup hook, and setup instructions.
- [ ] Re-run focused tests; expect failed cases recover/restart only for their owner.
- [ ] Run `npm test`, `npm run lint`, `npm run format:check`, server/client builds, and manual acceptance flow; expect all checks passing.

## Unresolved Product Decisions

- The specification permits MongoDB Atlas or local MongoDB. This build documents both; the deployment provider remains the project owner’s choice.
- The exact Gemini account, quotas, and production model availability are external configuration. The server fails clearly when no usable key is present in production.
