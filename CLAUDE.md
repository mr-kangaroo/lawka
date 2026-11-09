# Ławka — agent notes

Prototype of an AI-assisted shift report for night-club managers. **UI copy is Polish; code, comments, commits and docs are English.**

## Commands
- `npm run dev` — dev server on :3000
- `npm run build` — production build
- `npm run check` — lint, then `tsc --noEmit`, then `vitest run` (must stay green)
- `npm run lint` / `npm run typecheck` / `npm test`
- `npm run test:e2e` — Playwright (Desktop Chrome + Pixel 7; starts `npm run dev` if needed)

## Source of truth
The spec is the source of truth: `docs/superpowers/specs/2026-11-09-shift-report-design.md`. The plan is `docs/superpowers/plans/2026-11-09-shift-report.md`. Copy Polish UI strings verbatim from the spec.

## Boundaries (spec §7)
- `lib/report` is pure: no React, storage or network.
- The Zustand store (`store/shift.ts`) is the only place state changes.
- Only `lib/ai/gemini.ts` (server-only) talks to Gemini; it is used by the API route (`app/api/process-note/route.ts`) and `scripts/measure-models.ts`. The server never derives HH:MM from ISO timestamps (it may run in UTC); the client sends `startHHMM`/`nowHHMM`/`noteHHMM` in `AiContext`. `GOOGLE_GENERATIVE_AI_API_KEY` is server-only; never commit or print it.
- Tiptap is confined to `components/report/rich-editor.tsx`, `components/report/block-authorship.ts`, `lib/report/rich.ts` and `lib/report/editor-json.ts`.

## Conventions
- shadcn/ui (Radix base, style `radix-nova`), neutral theme, dark by default. No hard-coded hex colours except the amber "required" tokens (`text-required`, `border-required-border`, `bg-required-bg`).
- Library APIs move fast: read `node_modules/next/dist/docs/` (see `AGENTS.md`) and the installed package docs before using an API.
