# AGENTS.md

`engram-web`: Vue 3 SPA + dependency-free Node server that give a browser UI to the local
Engram memory runtime (`engram serve`, `http://127.0.0.1:7437`).

## Commands

| Command | What it does |
| --- | --- |
| `npm run typecheck` | `vue-tsc --noEmit`. Always run before claiming done. |
| `npm run build` | typecheck + Vite build into `dist/` (gitignored). |
| `npm run dev` | Vite on 5173, proxies `/api/*` to the runtime. Needs the runtime up. |
| `npm start` | Production server on 7438 serving `dist/`. Run `build` first. |
| `npm run smoke` | Read-only checks against a **live** runtime on 7437. Modifies nothing. |
| `npm run check:writes` | Write paths, network-free: intercepts `fetch`. |
| `npm run check:projects` | Project inventory, no runtime and no child processes. |
| `npm run check:commands` | Command catalog integrity, no runtime. |
| `npm run check:server` | Production server on an ephemeral port with a fake upstream. |

There is **no test framework, no linter, no formatter, no CI, and no `test` script**. The
`check:*` and `smoke` scripts ARE the test suite — they use `node:assert/strict`. Vitest was
considered and explicitly rejected (`odd/tasks/engram-web-hardening.md`).

The `scripts/*.ts` files are executed directly by `node` via native TypeScript stripping, so they
need **Node >= 23.6** (this repo runs Node 24). The README's "Node.js 20 o superior" is stale for
those scripts; `dev`/`build` are fine on 20.

Env: `ENGRAM_URL`, `ENGRAM_HTTP_TOKEN` (optional Bearer for protected routes), `ENGRAM_BIN`,
`ENGRAM_MCP_TIMEOUT_MS`, `PORT` (prod, default 7438). See README for defaults.

## Architecture

- `src/` — Vue 3 SPA. One view per route in `src/router.ts`; a route declares only the filter-bar
  fields its view actually reads. No Pinia on purpose: shared read state lives in
  `src/state/app-state.ts` as plain `reactive`/`ref`.
- `src/api/client.ts` — the only HTTP layer and the validating trust boundary for every response.
  Types in `src/api/types.ts`; static catalogs in `src/api/commands.ts` and `src/api/projects.ts`.
- `src/components/MarkdownView.vue` — `marked` + DOMPurify. Keep markdown sanitized.
- `server/server.mjs` — production: `dist/` with SPA fallback, `/api/*` pure rewrite to the
  runtime, `/local/projects` answered in-process. Exports `createEngramWebServer()` and must
  **never bind a port on import** (`check:server` depends on that).
- `server/projects.mjs` — `/local/projects` inventory via one `engram mcp --tools=mem_list_projects`
  stdio cycle. `vite.config.ts` mounts the same handler as dev middleware.
- Same-origin by design: the runtime emits no CORS headers and answers 405 to `OPTIONS`. Every
  browser call goes to `/api/*`. Never add a direct cross-origin call to 7437.

## Invariants that will bite

- `project` and `all_projects=true` must never travel together; `projectParams()` in `client.ts`
  enforces it. Empty `project` means "all projects", not "the runtime's cwd project".
- `getTimeline()` requires `project` or the runtime answers 404 "observation not found".
- `getProjects()` is the one call whose base is `''` instead of `/api`; it also shape-checks the
  payload because an older server falls through to the SPA fallback and returns `index.html`
  (200 `text/html`).
- Writes are a deliberate safe subset: **no hard delete and no import** — the runtime exposes no
  undelete, so `deleteObservation()` cannot express `?hard=true`. Do not widen this.
- Never point write checks at the live runtime: it holds the user's real memory and a soft delete
  is irreversible there. That is why `check:writes` replaces `globalThis.fetch`.
- `src/` imports omit the `.ts` extension; `scripts/` imports include it (`allowImportingTsExtensions`).

## Conventions

- Language split: UI copy, README, CHANGELOG, in-app help, `odd/tasks/*` → Spanish (Spain).
  Code comments, identifiers, commit messages and tags → English.
- Conventional Commits in English (`feat:`, `fix:`, `docs:`, `refactor:`).
- `CONTRATO_FLUJO_GIT_VERSIONADO.md` is the binding Git contract: **never** run `commit`, `push`,
  merge to `main`, `tag`, `reset`, `rebase` or `clean` without explicit user authorization, and
  report status as `Estado / Rama / Cambios / Commit / Pruebas`.
- `CHANGELOG.md` only for user-visible changes, under `[Sin publicar]`; not for internal refactors.
- The server is zero-dependency by design. Justify any new dependency.

## Where the work history lives

`odd/tasks/*.md` — one Spanish document per feature phase, with measured findings, decisions and
explicit out-of-scope items. Read the relevant file before touching that area; it records why
things are the way they are.

## Before saying done

`npm run typecheck`; the matching `check:*` script for what you touched (`check:server` for
`server/`, `check:writes` for write paths); `npm run build` when a view changed; `npm run smoke`
only when a runtime is listening on 7437.
