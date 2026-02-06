# CLAUDE.md - AI Assistant Guide for otterplan

## Project Overview

**otterplan** (package name: `schedule-neon`) is a Japanese event scheduling and date coordination tool (日程調整ツール). Users create events with candidate dates, share a link, and attendees vote on their availability. The organizer can then fix a date and optionally search for venues.

**Tech stack:** React 18 + Vite (frontend), Netlify Functions (serverless backend), NeonDB PostgreSQL (database).

**Language:** JavaScript/JSX only (no TypeScript). UI text is in Japanese.

## Build & Development Commands

```bash
# Install dependencies
npm install

# Start development (Vite dev server + Netlify functions)
npx netlify dev        # Full stack local dev (preferred)
npm run dev            # Frontend only (Vite, proxies /api to localhost:8888)

# Production build
npm run build          # Outputs to dist/

# Preview production build
npm run preview
```

**There are no tests, linters, or formatters configured.** No `npm test`, ESLint, Prettier, or TypeScript compilation steps exist.

## Project Structure

```
otterplan/
├── src/
│   ├── main.jsx                  # React entry point (mounts App)
│   └── App.jsx                   # Entire frontend UI (~1000 lines, single component)
├── netlify/functions/
│   ├── events.js                 # Event CRUD (GET/POST/PATCH)
│   ├── responses.js              # Response submission (POST)
│   └── venues.js                 # Venue search via Google Places API (POST)
├── index.html                    # HTML entry point
├── schema.sql                    # PostgreSQL schema (events + responses tables)
├── vite.config.js                # Vite config with API proxy
├── netlify.toml                  # Netlify deployment config
├── package.json                  # Dependencies and scripts
└── .env                          # DATABASE_URL (required), GOOGLE_MAPS_API_KEY (optional)
```

## Architecture

### Frontend (React SPA)

- **Single component architecture**: All UI lives in `src/App.jsx` — views, forms, state, styles, and helpers are all in one file.
- **State management**: React `useState` hooks only (no Redux, Context API, or external state libraries).
- **Routing**: No router library. Views switch based on `view` state variable (`'create'` or `'results'`). Event pages are loaded by reading `?id=` from the URL.
- **Styling**: All CSS is inline via JavaScript style objects. No CSS files, CSS modules, or CSS-in-JS libraries.
- **API calls**: Generic `api()` helper function at the top of `App.jsx` wrapping `fetch()`.

### Backend (Netlify Functions)

- Three serverless functions under `netlify/functions/`.
- Each exports an async `handler(event)` function.
- HTTP method routing done with `if/else` on `event.httpMethod`.
- Database access via `@neondatabase/serverless` — the `neon()` SQL client is initialized inside each handler call.
- CORS headers set on all responses (`Access-Control-Allow-Origin: *`).

### API Endpoints

| Method | Path | Function | Purpose |
|--------|------|----------|---------|
| GET | `/api/events?id={id}` | events.js | Fetch event with all responses |
| POST | `/api/events` | events.js | Create new event |
| PATCH | `/api/events` | events.js | Update fixed_candidate_id or venue |
| POST | `/api/responses` | responses.js | Submit availability response |
| POST | `/api/venues` | venues.js | Search venues (Google Places) |

### Database Schema (NeonDB PostgreSQL)

Two tables defined in `schema.sql`:

- **events**: `id` (VARCHAR PK), `title`, `description`, `candidates` (JSONB array of `{id, datetime}`), `fixed_candidate_id`, `venue` (JSONB), `created_at`, `updated_at`
- **responses**: `id` (VARCHAR PK), `event_id` (FK to events), `name`, `comment`, `answers` (JSONB map of `{candidateId: 'available'|'maybe'|'unavailable'}`), `created_at`

### Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | NeonDB PostgreSQL connection string |
| `GOOGLE_MAPS_API_KEY` | No | Google Places API key (falls back to mock data) |

## Code Conventions

- **File naming**: PascalCase for React components (`App.jsx`), lowercase for backend functions (`events.js`)
- **Variables/functions**: camelCase (`publishEvent`, `responderName`)
- **Database columns**: snake_case (`fixed_candidate_id`, `event_id`)
- **ID generation**: `Math.random().toString(36).substr(2, 9) + Date.now().toString(36)` — used in all backend functions
- **ES Modules**: `"type": "module"` in package.json — use `import`/`export` syntax
- **No semicolons policy is not enforced**: semicolon usage is inconsistent
- **2-space indentation** throughout

## Deployment

- **Platform**: Netlify (both SPA hosting and serverless functions)
- **Build command**: `npm run build`
- **Publish directory**: `dist`
- **Functions bundler**: esbuild
- **Routing**: `/api/*` rewrites to `/.netlify/functions/:splat`; SPA fallback for all other routes
- **No authentication**: Events are publicly accessible by their random ID

## Key Considerations When Making Changes

- `src/App.jsx` is a single monolithic component. Any UI changes go here. Be careful with the large file — read it before editing.
- All backend functions initialize the database connection inside the handler (not at module level) for serverless compatibility.
- JSONB columns (`candidates`, `answers`, `venue`) store structured data — serialize with `JSON.stringify()` when writing, parse from query results.
- Venue search gracefully falls back to mock data when `GOOGLE_MAPS_API_KEY` is not set.
- There are no tests. Verify changes manually or by running the dev server.
- The UI is entirely in Japanese — maintain Japanese text in any user-facing strings.
