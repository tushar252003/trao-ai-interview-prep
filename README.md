# Trao AI Interview Prep Kit

A complete implementation of the Trao Full-Stack Engineering Assessment: an application that turns a job description, company URL and interview timeline into a research-backed interview preparation kit.

## Stack

- Frontend: Next.js + Tailwind CSS
- Backend: Node.js + Express + TypeScript
- Database: MongoDB + Mongoose
- AI: Google Gemini API with structured JSON output
- Scraping: native `fetch` + Cheerio
- Tests: Vitest

Gemini structured output is used for predictable JSON, while the application validates the result again before saving. The official Gemini documentation recommends structured outputs for data extraction and JSON-shaped generation.

## Features

- Registration/login/logout with httpOnly JWT cookie
- User-owned kits
- JD textarea + company URL + days
- Background generation jobs with progress polling
- Company crawling with relative-link discovery/ranking
- robots.txt checks
- Production SSRF/private-address protection
- Public interview-process research using DuckDuckGo HTML results
- Deliberate multi-stage research/generation pipeline
- Requirement extraction with stable IDs and must/nice classification
- Separate technical/behavioural/system-design/company-fit question generation
- Deterministic coverage checking
- Second-pass missing-question generation
- Deterministic schedule allocation
- Appendix A kit structure
- Editable/reorderable questions and flashcards
- Generated/edited/pinned state so regeneration does not overwrite manual edits
- Practice mode with confidence tracking and weak-first ordering
- Batch entry point using the same generation pipeline
- Graceful partial research/failure handling
- Automated tests for coverage, scheduling and structure validation

## Setup

### 1. Install

Requires Node.js 20+.

```bash
npm install
npm --prefix backend install
npm --prefix frontend install
```

### 2. Environment

Copy `.env.example` to `backend/.env` and fill in:

```env
PORT=4000
FRONTEND_ORIGIN=http://localhost:3000
MONGODB_URI=mongodb://127.0.0.1:27017/trao_interview_prep
JWT_SECRET=your-long-secret
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-2.5-flash
```

MongoDB Atlas can be used instead of local MongoDB.

### 3. Run

From the repository root:

```bash
npm run dev
```

Frontend: http://localhost:3000  
Backend: http://localhost:4000/api/health

## Batch evaluation

The mandatory command is:

```bash
npm run evaluate -- --input <cases.json> --output <kits.json>
```

Example:

```bash
npm run evaluate -- --input examples/cases.json --output kits.json
```

The batch runner calls the same `generateKitPipeline()` used by the web API. It continues after a failed case and writes one output entry per input case.

## Architecture

```text
Next.js
  |
  | HTTP + cookies
  v
Express API
  |
  +-- Auth
  +-- Kits
  +-- Generation jobs
  |
  +--> Shared generation pipeline
          |
          +--> JD extraction
          +--> Company crawler
          +--> Public interview research
          +--> Company brief
          +--> Role analysis
          +--> Question generation by category
          +--> Deterministic coverage check
          +--> Second pass for gaps
          +--> Flashcards
          +--> Deterministic schedule
          +--> Structure validation
          |
          v
       MongoDB
```

## Why deterministic code is used for coverage and scheduling

The assessment explicitly requires these two decisions to be application logic rather than an LLM decision. Coverage is computed from requirement IDs attached to questions. Scheduling uses integer day allocation, prioritizes must-have/higher-difficulty questions, and always returns exactly the requested number of days.

## Generated / edited / pinned state

Questions and flashcards contain an internal `_state` extension:

- `generated`: safe to replace during regeneration
- `edited`: user changed it, so regeneration preserves it
- `pinned`: user explicitly locked it, so regeneration preserves it

The public Appendix A fields remain unchanged; `_state` is an additional internal field.

## Research approach

1. Fetch the submitted company URL.
2. Validate scheme and reject private/loopback/link-local addresses in production.
3. Read robots.txt where possible.
4. Extract same-site links.
5. Rank links by URL/anchor keywords such as careers, jobs, hiring, engineering, about, interview and handbook.
6. Fetch a bounded number of pages with a timeout, response-size limit and delay.
7. Search public web discussion for interview-process evidence.
8. If a source cannot be retrieved, record the gap rather than failing the complete kit.

The crawler does not assume `/careers` or `/jobs` exists.

## LLM sequencing

The pipeline intentionally makes separate calls:

1. Requirements from JD
2. Company brief from retrieved pages
3. Role/responsibilities
4. Technical questions
5. Behavioural questions
6. System-design questions
7. Company-fit questions
8. Flashcards
9. Coverage check in code
10. Missing-question generation if required
11. Final validation

Fetched text is placed in clearly delimited source-content sections and is treated as untrusted data.

## Rate limits and retries

LLM calls use exponential backoff for transient errors/rate limits. The crawler also uses bounded retries and a delay between requests. The pipeline caps research and prompt sizes to keep free-tier token use practical.

## Edge cases

- Invalid/timeout company URL: kit can still be generated from the JD, with an honest research gap.
- No hiring page: no fabrication; sources list contains only retrieved pages.
- Two-line JD: only supported requirements are generated.
- No public interview discussion: recorded as unavailable.
- Invalid LLM JSON: retries and validation.
- Duplicate kit: a fingerprint is stored and an existing user's matching kit can be reused.
- 1-day or 60-day schedules: exact requested count is produced.

## Security

- Passwords are bcrypt-hashed.
- JWT is stored in an httpOnly cookie.
- Kit queries are scoped by authenticated user ID.
- URL validation blocks private/link-local/loopback destinations in production.
- HTML size/content type are bounded.
- External page text is never treated as instructions.
- Environment secrets are not sent to the frontend.

## Tests

```bash
npm test
```

Covers:
- requirement coverage
- second-pass gap behaviour
- exact day allocation
- schedule references
- required kit structure
- stable ID relationships

## Deployment

Recommended free-tier shape:

- Frontend: Vercel
- Backend: Render/Railway/Fly-compatible service
- MongoDB: MongoDB Atlas

Set `NEXT_PUBLIC_API_URL` in the frontend deployment to the public backend URL and configure `FRONTEND_ORIGIN` on the backend.

## Known limitations

The public-search adapter uses DuckDuckGo's HTML search page rather than a paid search API. Search result availability can change, so the application treats missing public discussion as a valid partial-research state.

The batch command can take several minutes for multiple cases because it intentionally runs real crawling and LLM calls. Free-tier model rate limits are handled with retries, but provider quotas remain an external constraint.
