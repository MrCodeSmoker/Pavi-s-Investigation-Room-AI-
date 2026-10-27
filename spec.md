AI Mystery Room — Product & Technical Specification
Version: 1.0 · Status: Approved for build · Audience: Codex (implementation agent) and the project owner
Rule for the implementer: This document is the single source of truth. If code and spec disagree, the spec wins. If the spec is silent or ambiguous, choose the simplest option consistent with this document, and record the decision in docs/DECISIONS.md. Do not add features not listed here.
1. Project Overview
AI Mystery Room is a web game. The player types a short scenario or story seed (e.g. "A priceless painting vanished from a small-town art gallery during a charity night"). The backend uses Gemini to invent a complete fictional investigation: a case file, a cast of suspects, one hidden culprit, and a set of evidence items (WhatsApp-style chat screenshots, images, and CCTV-style camera recordings). All of it is AI-generated. The player studies the evidence, then selects the culprit and explains their reasoning. The game reveals whether they were right, shows the true solution, and scores them.
1.1 Goals
•	Generate a solvable, internally consistent mystery from any short user scenario.
•	Present evidence in a realistic, immersive UI (chat viewer, image gallery, CCTV player).
•	Let the player accuse a suspect and get a satisfying reveal.
•	Keep the AI's hidden truth secret from the client until the player submits an accusation.
1.2 Non-Goals (v1)
•	No multiplayer, leaderboards, payments, or social features.
•	No real people, real brands, or real events; everything is fictional.
•	No true video generation (see §6.4 for how "recordings" are done).
•	No mobile native app. Responsive web only.
2. Tech Stack
Layer	Choice
Database	MongoDB (Atlas or local) with Mongoose ODM
Backend	Node.js (LTS) + Express, JavaScript (ES modules)
Frontend	React (Vite) + React Router + Tailwind CSS
State/data fetching	TanStack Query (server state), React Context (auth)
AI	Google Gemini via the official @google/genai SDK, called only from the backend
Auth	JWT (httpOnly cookie) + guest mode
Validation	Zod (backend request + AI output validation)
File storage	Local disk /uploads in dev; abstracted behind a storage service so S3/Cloudinary can replace it
Testing	Vitest (frontend), Jest + Supertest (backend)
Model names are configuration, not code. Read them from env vars (§12). Defaults: text → gemini-2.5-flash; image → gemini-2.5-flash-image. Verify current model IDs against the Gemini API docs before building and update defaults if needed.
3. High-Level Architecture
React SPA ──HTTP/JSON──> Express API ──> MongoDB
                            │
                            └──> Gemini API (text + image)
                            └──> Storage service (generated images)
•	Case generation is asynchronous. POST /cases creates a case in generating status and returns immediately. A background worker function (in-process async job, no queue infra in v1) runs the pipeline. The client polls GET /cases/:id/status.
•	The Case Bible (hidden truth) is stored in the DB but never returned by any endpoint until the case is solved or failed by the requesting user's accusation.
4. Core User Flow
1.	Landing page → player enters scenario (10–500 chars), picks difficulty (Easy / Medium / Hard) and optional tone (Noir, Cozy, Corporate, Campus, Sci-Fi).
2.	Generation screen → animated "Building your case…" with live progress steps (Case File → Suspects → Chats → Images → Camera Footage → Finalising).
3.	Case Room → tabs: Case File, Suspects, Chats, Gallery, Camera Footage, Notebook.
4.	Player reviews evidence and keeps notes in the Notebook (client-side, saved to server).
5.	Player clicks Make Accusation → selects one suspect + writes a short reasoning (20–600 chars) → confirms.
6.	Reveal screen → correct/incorrect, the true culprit, motive, the full timeline, and which evidence pointed to the culprit. Score shown.
7.	Player can replay with a new scenario or generate a new case from the same scenario.
5. Functional Requirements
5.1 Authentication (FR-AUTH)
•	Register / login with email + password (bcrypt, min 8 chars). JWT in httpOnly, SameSite=Lax cookie, 7-day expiry.
•	Guest mode: POST /auth/guest creates a temporary user (isGuest: true) so players can play without signup. Guest data may be purged after 30 days.
•	Logged-in users can see My Cases history.
5.2 Case Creation (FR-CASE)
•	Input validated by Zod: scenario (10–500 chars), difficulty enum, tone enum (optional).
•	Scenario passes through a moderation/sanitisation step (§9.3) before it reaches the prompt.
•	Rate limit: max 5 case generations per user per hour (guests: 3).
•	A user may have at most 2 cases in generating status at once.
5.3 Case Room (FR-ROOM)
•	Shows only the player-visible case data (§7.2 publicView).
•	Evidence is unlocked all at once in v1 (no progressive reveal). The unlockOrder field exists in the schema for future use.
•	Notebook: free-text textarea per case, autosaved (debounced 1.5 s) via PATCH /cases/:id/notes.
5.4 Accusation (FR-ACCUSE)
•	Exactly one accusation per case. After submission, the case is locked.
•	Server compares suspectId to the hidden culpritId.
•	Response includes the full reveal payload (§8.5).
5.5 Scoring (FR-SCORE)
•	Correct accusation: base 100 points.
•	Difficulty multiplier: Easy ×1, Medium ×1.5, Hard ×2.
•	Time bonus: up to +25 if solved within 10 minutes of first opening the Case Room (linear decay to 0 at 30 minutes).
•	Incorrect accusation: 0 points.
•	Reasoning text is not graded by AI in v1; it is stored and displayed alongside the reveal.
6. AI Generation Pipeline (Gemini)
Generation is a multi-stage pipeline. Each stage returns strict JSON validated by Zod. The Case Bible from Stage 1 is passed into every later stage so everything stays consistent.
6.1 Stage 1 — Case Bible (text, JSON mode)
Input: scenario, difficulty, tone. Output (the hidden truth plus public setup):
{
  "title": "string",
  "setting": "string (place, date, time window)",
  "crimeSummary": "string (public-safe summary of what happened)",
  "suspects": [
    {
      "id": "s1",
      "name": "string (fictional)",
      "role": "string",
      "age": 0,
      "appearance": "string (used for image prompts, must stay consistent)",
      "publicBio": "string",
      "alibi": "string (what they claim)",
      "secret": "string (hidden)",
      "motive": "string (hidden)"
    }
  ],
  "culpritId": "s2",
  "truth": {
    "method": "string",
    "motive": "string",
    "timeline": [{ "time": "21:10", "event": "string", "suspectIds": ["s2"] }],
    "alibiBreak": "string (how culprit's alibi is disproved)"
  },
  "cluePlan": [
    {
      "clueId": "c1",
      "type": "chat | image | camera",
      "role": "decisive | supporting | red_herring",
      "points_to": ["s2"],
      "description": "string"
    }
  ]
}
Hard constraints (enforced by prompt AND server-side validation):
•	Suspect count: Easy 3, Medium 4, Hard 5.
•	Exactly one culprit; culpritId must exist in suspects.
•	Clue plan size: Easy 5–6, Medium 7–9, Hard 9–12 clues.
•	At least 3 clues (≥1 decisive) must point to the culprit; at least 1 red herring per non-culprit suspect on Medium/Hard (at least 1 total on Easy).
•	Must include at least 2 chat, 2 image and 1 camera clue.
•	The culprit must be deducible from evidence alone, with no outside knowledge.
•	All names, places and organisations are fictional. No real public figures, brands, or trademarks.
If validation fails, retry Stage 1 up to 2 times, appending the validation errors to the prompt. After that, mark the case failed.
6.2 Stage 2 — Chat Evidence (text, JSON mode)
For each chat clue in cluePlan, generate a WhatsApp-style conversation:
{
  "clueId": "c1",
  "chatTitle": "string (contact or group name)",
  "isGroup": false,
  "participants": [{ "name": "string", "suspectId": "s1 | null" }],
  "messages": [
    { "sender": "string", "text": "string", "timestamp": "2026-03-14T21:05:00", "status": "read | delivered", "deleted": false }
  ]
}
•	8–25 messages per chat. Natural, casual language and realistic abbreviations. Timestamps must be chronological and consistent with truth.timeline.
•	Clues must be embedded subtly in dialogue, never stated outright ("I did it" is forbidden).
•	Messages marked deleted: true render as "This message was deleted" and may be used as a clue.
6.3 Stage 3 — Image Evidence (image model)
For each image clue, first ask the text model for an image prompt (≤ 80 words) using the Case Bible's appearance fields, then call the image model.
•	Images: photos of objects, scenes, receipts, notes, or a screenshot-like picture. Style: realistic, slightly imperfect "phone camera" look.
•	No readable critical text inside images (image models render text unreliably). Any decisive textual information must live in the image's caption / metadata (e.g. EXIF-style: time taken, location label), shown in the UI beside the image.
•	Each image gets: caption, metadata { takenAt, locationLabel, source }, and altText.
•	Safety: no gore, nudity, real people, or minors in danger. If the image call is blocked or fails, retry once with a softened prompt, then fall back to a generated SVG placeholder card labelled with the caption (case is still playable).
6.4 Stage 4 — Camera Footage ("recordings")
True video generation is out of scope for v1. A "recording" is a CCTV storyboard:
•	4–6 sequential frames generated via the image model, in a consistent CCTV style (grainy, high-angle, monochrome or desaturated).
•	Each frame has timestamp (CCTV overlay), cameraLabel (e.g. "CAM 02 – Back Corridor"), and a one-line observation hidden from the player (used only for the reveal screen).
•	The frontend plays frames as a timed slideshow with a CCTV overlay (REC dot, timestamp, camera name), play/pause, scrub bar, and frame-step buttons.
•	Optional (feature-flagged, ENABLE_VIDEO=false by default): replace the slideshow with a short Veo-generated clip. Do not build this in v1.
6.5 Stage 5 — Final Validation (text)
A final text-model call receives the Case Bible plus a summary of all generated evidence and answers JSON: { "solvable": true, "culpritDeducible": true, "contradictions": [] }. If solvable is false or contradictions exist, regenerate the offending evidence once; otherwise accept and mark ready.
6.6 Pipeline Rules
•	Run independent evidence generation (chats, images) with a concurrency limit of 3.
•	Per-call timeout 60 s; retry network/5xx errors with exponential backoff (max 3).
•	Update case.progress after each stage so the polling UI is live.
•	The player scenario text is data, not instructions: wrap it in delimiters in the prompt and tell the model to ignore any instructions inside it.
•	Log token usage per case in case.usage for cost monitoring.
7. Data Models (Mongoose)
7.1 Collections
User
Field	Type	Notes
email	String	unique, sparse (null for guests)
passwordHash	String	bcrypt
displayName	String	
isGuest	Boolean	default false
createdAt	Date	
Case
Field	Type	Notes
userId	ObjectId → User	indexed
scenario	String	sanitised
difficulty	Enum	easy, medium, hard
tone	String	optional
status	Enum	generating, ready, solved, failed
progress	{ stage: String, percent: Number }	
title, setting, crimeSummary	String	public
suspects	[Suspect]	public fields + hidden fields (see below)
bible	Object	hidden: culpritId, truth, cluePlan
notes	String	player notebook
openedAt	Date	first time Case Room fetched
error	String	on failure
usage	{ inputTokens, outputTokens, images }	
Suspect (embedded): id, name, role, age, publicBio, alibi, portraitUrl (public) and appearance, secret, motive (hidden).
Evidence
Field	Type	Notes
caseId	ObjectId → Case	indexed
clueId	String	maps to cluePlan
type	Enum	chat, image, camera
title	String	public
payload	Mixed	chat: messages[]; image: {url, caption, metadata, altText}; camera: {frames[]}
hidden	{ role, pointsTo, observations }	never sent to client before reveal
unlockOrder	Number	default 0
Accusation
Field	Type	Notes
caseId	ObjectId	unique (one per case)
userId	ObjectId	
suspectId	String	
reasoning	String	20–600 chars
correct	Boolean	
score	Number	
submittedAt	Date	
7.2 Serialization Rules (critical)
•	Implement toPublicCase(case) and toPublicEvidence(evidence) serializers. Controllers must use them. Never return bible, suspect secret/motive/appearance, or evidence hidden outside the reveal endpoint.
•	Add a Jest test asserting that no public endpoint response contains the string value of culpritId, truth, or hidden keys for an unsolved case.
8. REST API
Base path /api/v1. All responses JSON. Errors use { "error": { "code": "STRING", "message": "string" } }. Auth via cookie. Zod validates every body/param.
8.1 Auth
Method	Path	Body	Response
POST	/auth/register	email, password, displayName	201 user
POST	/auth/login	email, password	200 user
POST	/auth/guest	–	201 user
POST	/auth/logout	–	204
GET	/auth/me	–	200 user or 401
8.2 Cases
Method	Path	Description
POST	/cases	Body {scenario, difficulty, tone?} → 202 {caseId}; starts pipeline
GET	/cases	List the current user's cases (id, title, status, difficulty, createdAt, score)
GET	/cases/:id/status	{status, progress:{stage,percent}, error?}
GET	/cases/:id	Public case view (404 if not owner)
PATCH	/cases/:id/notes	Body {notes} (max 5000 chars)
DELETE	/cases/:id	Delete case, evidence, stored images
POST	/cases/:id/regenerate	Only for failed cases; restarts pipeline
8.3 Evidence
Method	Path	Description
GET	/cases/:id/evidence	Public evidence list, grouped by type
8.4 Accusation
Method	Path	Description
POST	/cases/:id/accuse	Body {suspectId, reasoning} → reveal payload. 409 if already accused or case not ready.
8.5 Reveal Payload
{
  "correct": true,
  "score": 187,
  "culprit": { "id": "s2", "name": "string" },
  "truth": { "method": "", "motive": "", "timeline": [], "alibiBreak": "" },
  "decisiveEvidence": [{ "evidenceId": "", "title": "", "explanation": "" }],
  "redHerrings": [{ "evidenceId": "", "title": "", "explanation": "" }],
  "yourAccusation": { "suspectId": "", "reasoning": "" }
}
8.6 Static
GET /uploads/... serves generated images with cache headers. Filenames are random UUIDs (unguessable) and are scoped to the owning case.
9. Security, Safety & Limits
1.	Gemini API key lives in server env only. Never exposed to or proxied through the client.
2.	Rate limiting: express-rate-limit globally (100 req / 15 min / IP) plus the per-user generation limits in §5.2.
3.	Moderation of scenarios: reject (400, SCENARIO_NOT_ALLOWED) scenarios involving sexual content, minors in harm, real named individuals, real-world terror/extremism, or instructions for real crimes. Implement as a cheap Gemini classification call returning {allowed, reason} before generation. Mysteries are fictional whodunits (theft, fraud, sabotage, disappearance, etc.). Violence is allowed only in a non-graphic, classic-detective-fiction sense.
4.	Prompt-injection defence: scenario text delimited and treated as data (§6.6); AI outputs are always Zod-validated; never eval or render AI output as raw HTML (escape in React; no dangerouslySetInnerHTML).
5.	HTTP hardening: helmet, CORS restricted to CLIENT_URL, cookies httpOnly, secure in production, body size limit 100 kB.
6.	Ownership checks: every /cases/:id* route verifies case.userId === req.user.id.
7.	Fictional-only disclaimer visible on the landing page and the footer of the Case Room.
10. Frontend Specification
10.1 Routes
Path	Page	Auth
/	Landing + scenario form	public
/login, /register	Auth forms (with "Play as guest" button)	public
/generating/:id	Generation progress	owner
/case/:id	Case Room	owner
/case/:id/reveal	Reveal	owner, only after accusation
/cases	My Cases	owner
10.2 Key Components
•	ScenarioForm – textarea with live char counter, difficulty selector, tone chips, submit.
•	GenerationProgress – stepper bound to progress.stage, polls /status every 2 s, redirects on ready, shows retry on failed.
•	CaseFilePanel – title, setting, crime summary.
•	SuspectCard / SuspectGrid – portrait, name, role, bio, alibi.
•	ChatViewer – list of chats; opening one renders a WhatsApp-style conversation (bubbles left/right by sender, timestamps, double-tick status, "message deleted" style). Group chats show sender names.
•	ImageGallery + ImageLightbox – thumbnail grid, full-size view with caption and metadata panel.
•	CCTVPlayer – slideshow player with overlay (REC dot, timestamp, camera label), play/pause, scrub bar, step buttons, subtle scanline/noise CSS effect.
•	Notebook – autosaving textarea in a side drawer.
•	AccuseModal – suspect radio list, reasoning textarea, two-step confirmation ("This cannot be undone").
•	RevealView – animated verdict, culprit card, timeline, decisive evidence and red herrings, score breakdown, "Play again" button.
10.3 UX Requirements
•	Theme: dark detective-room aesthetic (charcoal background, amber accent, monospace case-file headings, paper-texture cards). Light mode not required.
•	Fully responsive (≥ 360 px wide). Case Room tabs become a bottom nav on mobile.
•	Loading skeletons for lists; clear error states with retry for every query.
•	Accessible: semantic HTML, keyboard-navigable tabs and modals, alt text on every image, visible focus rings, contrast ≥ 4.5:1.
•	Never display hidden fields; the UI must work purely from the public API.
11. Project Structure
ai-mystery-room/
├─ docs/ (SPEC.md, DECISIONS.md)
├─ server/
│  ├─ src/
│  │  ├─ config/ (env.js, db.js)
│  │  ├─ models/ (User.js, Case.js, Evidence.js, Accusation.js)
│  │  ├─ routes/ (auth, cases, evidence, accuse)
│  │  ├─ controllers/
│  │  ├─ middleware/ (auth, validate, rateLimit, error)
│  │  ├─ services/
│  │  │  ├─ gemini/ (client.js, prompts/, schemas/, pipeline.js)
│  │  │  ├─ storage.js
│  │  │  ├─ moderation.js
│  │  │  └─ scoring.js
│  │  ├─ serializers/ (publicCase.js, publicEvidence.js)
│  │  └─ app.js, server.js
│  └─ tests/
└─ client/
   └─ src/ (api/, components/, pages/, hooks/, context/, styles/)
Prompts live in server/src/services/gemini/prompts/ as separate template files, one per stage, so they can be tuned without touching pipeline code.
12. Environment Variables
# server/.env
PORT=5000
NODE_ENV=development
MONGODB_URI=
JWT_SECRET=
CLIENT_URL=http://localhost:5173
GEMINI_API_KEY=
GEMINI_TEXT_MODEL=gemini-2.5-flash
GEMINI_IMAGE_MODEL=gemini-2.5-flash-image
ENABLE_VIDEO=false
UPLOAD_DIR=./uploads

# client/.env
VITE_API_URL=http://localhost:5000/api/v1
Commit .env.example files only; never commit secrets.
13. Non-Functional Requirements
•	Performance: a Medium case generates in under 3 minutes in typical conditions; Case Room loads in under 2 s after generation.
•	Reliability: pipeline failures never leave a case stuck in generating: on server restart, any generating case older than 10 minutes is marked failed.
•	Cost control: hard cap on images per case (Easy 8, Medium 12, Hard 16 including portraits and camera frames).
•	Observability: structured logging (pino) with caseId on every pipeline log line.
•	Code quality: ESLint + Prettier configured; no console.log in committed code.
14. Testing & Acceptance Criteria
Backend tests (must pass):
1.	Zod rejects invalid scenarios, difficulties, and accusation bodies.
2.	Public serializers never leak hidden fields (§7.2).
3.	A second accusation on the same case returns 409.
4.	Non-owner access returns 404.
5.	Scoring function returns the correct values for all difficulty/time combinations.
6.	Pipeline with a mocked Gemini client produces a ready case; with repeated invalid output produces failed.
Manual acceptance (definition of done for v1):
•	Enter a scenario → case reaches ready → all three evidence types render correctly.
•	Accusing the correct and an incorrect suspect each shows the right reveal.
•	The Network tab never shows the culprit before accusation.
•	Guest and registered flows both work end-to-end.
•	App is usable at 360 px width.
15. Build Order (Milestones)
1.	M1 – Foundations: repo scaffold, env config, Mongo connection, Express app, error/validation middleware, Vite + Tailwind client shell.
2.	M2 – Auth: register, login, guest, logout, /me; client auth context and protected routes.
3.	M3 – Case model & fake pipeline: schemas, serializers, POST /cases, status polling, a stub pipeline returning hard-coded sample data so the whole UI can be built without Gemini.
4.	M4 – Case Room UI: case file, suspects, chat viewer, gallery, CCTV player, notebook (against stub data).
5.	M5 – Accusation & reveal: endpoint, scoring, reveal UI.
6.	M6 – Real Gemini pipeline: Stages 1–5 with validation, retries, storage service, moderation.
7.	M7 – Hardening: rate limits, helmet, tests, leak test, accessibility pass, restart-recovery job.
8.	M8 – Polish: animations, empty/error states, README with setup instructions.
Each milestone must run end-to-end before the next begins.
16. Future Scope (do NOT build in v1)
Progressive evidence unlocking, interrogation chat with suspects (Gemini role-play), AI grading of the player's reasoning, real video via Veo, shareable case links, leaderboards, daily challenge, audio evidence (voice notes).
17. Assumptions Made
•	Guest mode is allowed so players can try the game without signing up.
•	"Cam recordings" are implemented as CCTV image storyboards, not true video, to control cost and latency.
•	Critical text is kept out of generated images because image models render text unreliably; it is surfaced through captions and metadata instead.
•	Player-facing language is English only in v1.
 