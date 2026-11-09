# Ławka — Shift Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a clickable, deployed prototype of the "Raport ze zmiany" (shift report) flow. A night-club manager logs notes into a shift journal, and an AI continuously turns them into a structured, editable report that is reviewed and "sent" at closing.

**Architecture:**
- One Next.js page with two tabs, **Dziennik zmiany** (journal) and **Raport** (report), plus one input at the bottom.
- All state is one `Shift` object in a Zustand store persisted to localStorage.
- Each note goes to `POST /api/process-note`. The server asks Gemini for a list of `Operation`s. The pure function `applyOperations` merges them into the shift.
- Domain logic lives in pure `lib/report/*`, is unit-tested, and has no React.

**Tech Stack:**
- Next.js (App Router, latest 16.x) and TypeScript
- Tailwind CSS v4 and shadcn/ui
- Tiptap v3
- Zustand v5 (`persist`)
- Vercel AI SDK (`ai` latest) with `@ai-sdk/google` and Zod
- Vitest and Playwright
- npm as the package manager

**Spec:** `docs/superpowers/specs/2026-11-09-shift-report-design.md` (v3). **Read it before your task.** Section references below (§x.y) point into it. UI copy is Polish and must be copied **verbatim** from the spec.

**Visual reference:** https://claude.ai/artifact/3jojprCgVBaPsRuMua5Ykm
- The "v2" row is the target layout.
- Frame "1 · Notes feed + report as a document" and frame "1 · Open states (popovers)" hold the report details.

## Global Constraints

- UI copy is Polish, exactly as in the spec. Code, comments, commit messages and docs are in English.
- **No branding.** Use the neutral shadcn theme, **dark by default** (`<html class="dark">`), and the Inter font from `next/font/google`. Only shadcn/Tailwind tokens: no hard-coded hex colours in components except the amber "required" accent. Define that accent as tokens in `app/globals.css`:
  - `--required` = amber-300 text
  - `--required-border` = amber-700
  - `--required-bg` = amber-950/60

  Use them as `text-required`, `border-required-border` and `bg-required-bg`.
- AI authorship is **never shown** in the report (D9). The journal's routing tag ("→ Incydent #1") is the only AI label, and it has no ✦.
- Manual edits always win (D8). AI operations never change manager-owned data.
- Notes are never edited or deleted (D11).
- **Secrets:**
  - `GOOGLE_GENERATIVE_AI_API_KEY` is server-only. It's already in `.env.local`, so never print it or commit it.
  - `.env.example` lists the variable name with no value.
- **Minimum tap target is 44 px** on phone-width layouts.
- **Commands every task must keep green:**
  - `npm run check`: lint, then `tsc --noEmit`, then `vitest run`
  - `npm run build`
- **Git workflow per task** (D: §9):
  - Branch `task-NN-<slug>` from `main`, with small commits.
  - When the task is done: `git push -u origin HEAD`, then `gh pr create --fill`.
  - The controller reviews, then runs `gh pr merge --squash --delete-branch`.
  - Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. PR bodies end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **Library APIs move fast. Before using Next, AI SDK, Tiptap or shadcn APIs, read the installed docs:**
  - Next: `node_modules/next/dist/docs/`
  - AI SDK: `node_modules/ai/README.md` and docs, plus `@ai-sdk/google`
  - Never guess an API from memory.

## Review Focus

These are the failure modes most likely to bite a real user. Each one is pinned by a test in the task that owns the code.

1. **Polish diacritics in search.** Typing "boj" or "lazienka" must match "Bójka" or "Łazienka".
   - `normalizeForSearch` in Task 2, used by the type and place pickers.
2. **Times after midnight.** A shift starting at 20:00 with events at 23:50, 00:30 and 01:25 must sort as 23:50 → 00:30 → 01:25, not by clock value. Invalid input like "25:99" or "ab" is rejected.
   - `parseHHMM` and `minutesFromShiftStart` in Task 2.
3. **Stale AI responses.** An AI response can arrive after its target incident was removed, or after the report was sent.
   - Operations on unknown ids are ignored, and the note still becomes `processed` (Task 3).
   - When the shift is `sentAt`, the store ignores results and leaves the note as is (Task 6).
4. **Bad localStorage.** Corrupted or old data (bad JSON, an unknown version) must not crash the app at 3 a.m. Fall back to the demo shift.
   - Task 6, `migrate`/`onRehydrateStorage` test.
5. **Empty or whitespace-only notes** are ignored, and sending is disabled. A 2,000-character note still works.
   - Task 6 (`submitNote`) and Task 8 (Composer).

---

### Task 1: Scaffold, tooling and deploy pipeline

**Files:**
- Create: the Next.js app in the repo root (`app/`, `components/ui/`, `lib/utils.ts`), `vitest.config.ts`, `playwright.config.ts`, `tests/unit/smoke.test.ts`, `.env.example`, `CLAUDE.md`, `README.md`
- Modify: `.gitignore` (merge with the one create-next-app writes, and keep the existing `.env*` rules)

**Interfaces:**
- Produces:
  - npm scripts `dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e`, `check`
  - the shadcn components listed in spec §7
  - the `cn()` helper in `lib/utils.ts`

- [ ] **Step 1: Scaffold.**
  - The repo already has `.git`, `.gitignore`, `.env.local` and `docs/`, all of which create-next-app allows.
  - Run: `npx create-next-app@latest . --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --turbopack --yes`
  - If it refuses because of the existing files, scaffold into `/tmp/lawka-scaffold` and copy everything except `.git` into the repo.
- [ ] **Step 2: Add shadcn/ui.**
  - Run `npx shadcn@latest init` with the neutral base colour and CSS variables.
  - Add: button, popover, calendar, command, dropdown-menu, dialog, tabs, tooltip, sonner, avatar, textarea, badge.
  - Read each generated `components/ui/*` file, so you know whether it's Radix-based or base-ui-based, before using its props.
- [ ] **Step 3: Install runtime dependencies.**
  - `npm i zustand zod ai @ai-sdk/google @tiptap/react @tiptap/pm @tiptap/starter-kit`
  - Dev: `npm i -D vitest @vitest/coverage-v8 jsdom @playwright/test`
  - Then `npx playwright install chromium`.
- [ ] **Step 4: Configure the scripts and tools.**
  - `typecheck` = `tsc --noEmit`, `test` = `vitest run`, `test:e2e` = `playwright test`, `check` = `npm run lint && npm run typecheck && npm run test`.
  - **Vitest:** `environment: 'node'` by default, the `@` alias, and `include: ['tests/unit/**/*.test.ts']`.
  - **Playwright:** chromium only, `baseURL http://localhost:3000`, `webServer: npm run dev` with `reuseExistingServer: true`, and two projects: Desktop Chrome and Pixel 7.
- [ ] **Step 5: Theme.**
  - `app/layout.tsx`: `lang="pl"`, `className="dark"`, Inter, `<title>Raport ze zmiany</title>`, and the `<Toaster />` from sonner.
  - Add the `--required*` tokens (see Global Constraints) to `app/globals.css`.
  - `app/page.tsx` renders a placeholder `<h1>Raport ze zmiany</h1>`.
- [ ] **Step 6: Smoke test.**
  - Write `tests/unit/smoke.test.ts` asserting `cn('a', false && 'b', 'c') === 'a c'`.
  - Run `npm run check`. Expected: all pass.
  - Run `npm run build`. Expected: success.
- [ ] **Step 7: Docs.**
  - `.env.example`: `GOOGLE_GENERATIVE_AI_API_KEY=`.
  - `CLAUDE.md`:
    - commands
    - "the spec is the source of truth" with its path
    - the boundaries from spec §7: `lib/report` is pure, the store is the only mutator, the API route is the only Gemini code, Tiptap is confined to `components/report/rich-editor.tsx` and `lib/report/rich.ts`
    - Polish UI copy and English code
  - `README.md`: a one-paragraph stub (it's finished in Task 12).
- [ ] **Step 8: Commit, push, PR.** Commit: `chore: scaffold Next.js app with shadcn, vitest, playwright`.
- [ ] **Step 9: Deploy pipeline (USER action, controller asks).**
  - The user imports `mr-kangaroo/lawka` in Vercel (Add New → Project). Framework: Next.js.
  - They add the env var `GOOGLE_GENERATIVE_AI_API_KEY` for Production and Preview.
  - Verify: the PR's preview URL shows "Raport ze zmiany".
  - Merge only after the preview works.

---

### Task 2: Domain types, catalog, time and text helpers

**Files:**
- Create:
  - `lib/report/types.ts`
  - `lib/report/catalog.ts`
  - `lib/report/people.ts`
  - `lib/report/time.ts`
  - `lib/report/search.ts`
  - `lib/report/rich.ts`
- Test:
  - `tests/unit/time.test.ts`
  - `tests/unit/search.test.ts`
  - `tests/unit/rich.test.ts`

**Interfaces:**
- **Produces (types, in `types.ts`):** exactly spec §5. That covers `ISO`, `Author`, `Provenance`, `Field<T>`, `Attachment`, `Note`, `EventTime` (with `sourcePhrase?`), `Incident`, `SectionKey`, `BlockAttrs`, `RichBlock`, `RichInline`, `RichDoc`, `Section`, `GapTarget`, `Gap`, `AiQuestion`, `Person` and `Shift`. Add these changes:
  - **`Note`:**
    - `status: 'pending' | 'processed' | 'failed'`
    - `answersGapId?: string`: the note answers a question chip
    - `replyTo?: string`: the note answers an `AiQuestion`
  - **`Shift`:** `sentAt?: ISO`, replacing `closedAt`, plus `noIncidentsConfirmed: boolean`.
  - **`Gap`:** `answeredByNoteId?: string`.
- **Produces (`catalog.ts`):**
  - `SECTION_LABELS: Record<SectionKey, string>`, with the Polish labels from spec §4.5. Note: `audience` = "Publiczność i bezpieczeństwo", `production` = "Produkcja / przebieg / otwarcie drzwi".
  - `FIXED_SECTIONS: SectionKey[] = ['summary','audience','security','maintenance']` (incidents are rendered separately, between summary and audience).
  - `CONDITIONAL_SECTIONS` in brief order: `['doorStaff','artists','production','bar','kitchen','suppliers','privateEvents','stock']`.
  - `HINT_ORDER: SectionKey[] = ['bar','doorStaff','production','stock','artists','kitchen','suppliers','privateEvents']`.
  - `HINT_LABEL_OVERRIDES = { production: 'Produkcja / przebieg' }`.
  - `EMPTY_SECTION_PROMPTS: Partial<Record<SectionKey,string>>`:
    - `security`: "Co z ochroną? Napisz w notatce albo potwierdź."
    - `audience`: "Co z publicznością? Napisz w notatce albo potwierdź."
    - `maintenance`: "Jakieś usterki? Napisz w notatce albo potwierdź."
  - `INCIDENT_TYPES`: the 11 types from §4.4.
  - `VENUE_AREAS`: the 9 areas from §4.4 (including "Toaleta damska" and "Toaleta męska").
  - `INCIDENT_FIELD_QUESTIONS = { type: 'Jaki typ zdarzenia?', location: 'Gdzie?', description: 'Opis zdarzenia?', time: 'Dokładna godzina?' }`.
- **Produces (`people.ts`):** `PEOPLE: Person[]`, the 4 mock people from §4.3 with ids `kasia`, `tomek`, `ola` and `marek`. `Person` gets a `tone: 'blue'|'teal'|'purple'|'pink'` for the avatar colour.
- **Produces (`time.ts`):**
  - `parseHHMM(input: string): string | null`: accepts "1:25", "01:25", "1.25" and "0125", and returns "01:25". Returns `null` for anything outside 00:00–23:59.
  - `minutesFromShiftStart(hhmm: string, startHHMM: string): number`: times earlier than the start count as after midnight.
  - `formatHHMM(iso: ISO): string`.
- **Produces (`search.ts`):** `normalizeForSearch(s: string): string` (lowercase, strip diacritics, with ł→l) and `matches(query: string, label: string): boolean`.
- **Produces (`rich.ts`):**
  - `emptyDoc(): RichDoc`
  - `paragraphsToBlocks(paragraphs: string[], attrs: BlockAttrs): RichBlock[]`: consecutive lines that start with "- " become one `bulletList`.
  - `appendBlocks(doc: RichDoc, blocks: RichBlock[]): RichDoc`
  - `appendSentence(doc: RichDoc, text: string, attrs: BlockAttrs): RichDoc`: appends to the last block if it's an `ai` paragraph, otherwise adds a new paragraph.
  - `replaceAiBlocks(doc: RichDoc, blocks: RichBlock[]): RichDoc`
  - `hasManagerBlocks(doc: RichDoc): boolean`
  - `isDocEmpty(doc: RichDoc): boolean`
  - `docToPlainText(doc: RichDoc): string` (paragraphs joined by "\n", bullets prefixed "- ")
  - All are pure and never mutate their inputs.

- [ ] **Step 1: Write failing tests.**
  - `time.test.ts`:
    - `parseHHMM('1:25') === '01:25'`, `parseHHMM('0125') === '01:25'`, `parseHHMM('23.5')` is `null`, `parseHHMM('25:99')` is `null`, `parseHHMM('ab')` is `null`.
    - Sorting `['01:25','23:50','00:30']` by `minutesFromShiftStart(x,'20:00')` gives `['23:50','00:30','01:25']`.
  - `search.test.ts`:
    - `matches('boj','Bójka')`, `matches('LAZ','Łazienka')`, `matches('męsk','Toaleta męska')`, and `!matches('kradz','Bójka')`.
  - `rich.test.ts`:
    - `paragraphsToBlocks(['A','- x','- y','B'], attrs)` gives 3 blocks: paragraph, bulletList with 2 items, paragraph.
    - `appendSentence` on a doc whose last block is `ai` changes `docToPlainText` from "A." to "A. B.". On a doc whose last block is `manager`, it adds a new block.
    - `replaceAiBlocks` keeps manager blocks in place.
    - `hasManagerBlocks` and `isDocEmpty` are true or false as expected.
    - The input doc is unchanged after every call (check with `structuredClone` equality).
- [ ] **Step 2:** Run `npx vitest run tests/unit/time.test.ts tests/unit/search.test.ts tests/unit/rich.test.ts`. Expected: FAIL (modules not found).
- [ ] **Step 3: Implement** `types.ts`, `catalog.ts`, `people.ts`, `time.ts`, `search.ts` and `rich.ts` with the signatures above.
- [ ] **Step 4:** Run the same tests. Expected: PASS. Then run `npm run check` and expect it green.
- [ ] **Step 5: Commit** with `feat(report): domain types, catalog, time/search/rich helpers`, then open the PR.

---

### Task 3: Operations schema and `applyOperations`

**Files:**
- Create: `lib/report/operations.ts`, `lib/report/ids.ts`
- Test: `tests/unit/operations.test.ts`

**Interfaces:**
- Consumes: Task 2 types and `rich.ts`.
- Produces:
  - **`ids.ts`:** `type IdGen = () => string` and `createIdGen(prefix?: string): IdGen` (crypto.randomUUID in the app, counters in tests).
  - **`operations.ts`:**
    - `OperationSchema`: a Zod discriminated union on `op`, exactly the 8 operations in spec §6.2, including `appendToIncident`. `updateIncident` has no `description`. `EventTime` includes `sourcePhrase?`.
    - `OperationsResponseSchema = z.object({ operations: z.array(OperationSchema) })`
    - `type Operation = z.infer<typeof OperationSchema>`
    - `applyOperations(shift: Shift, ops: Operation[], noteId: string, now: ISO, newId: IdGen): Shift`

**Rules to implement**, which must match spec §6.3:
- **Return a new `Shift`.** Never mutate the input.
- **`addIncident`:**
  - Creates an `Incident`: `createdAt` = the note's `createdAt`, each field a `Field` with `prov {by:'ai', at: now, sourceNoteIds:[noteId]}`, and `description` = `paragraphsToBlocks([description], attrs)`.
  - Copies the note's attachments onto it.
  - Clears `noIncidentsConfirmed`.
- **`updateIncident`:** sets only the fields whose current `prov.by !== 'manager'`, or that are null.
- **`appendToIncident`:** uses `appendSentence` on the description, creating the description if it's null.
- **`appendToSection`:** creates the section if it's missing and appends blocks with `by:'ai'`. It never touches existing blocks.
- **`setSummary`:** ignored if the summary has manager blocks. Otherwise it does `replaceAiBlocks`.
- **`addGap`:** skipped when an open gap with the same target JSON and question exists. Otherwise it pushes a gap with `status:'open'`.
- **`resolveGap`:** sets `status:'answered'`.
- **`askQuestion`:** pushes an `AiQuestion {noteId, status:'open'}`.
- **Unknown `incidentId` or `gapId`:** the operation is skipped and nothing is thrown.
- **Attachments:** if no `addIncident` or `appendToIncident` was applied, the note's attachments go to the first section the note fed.
- **Afterwards:**
  - The note becomes `status:'processed'`, with `routedTo` = the labels of what was actually applied ("Incydent #N" with N = the display number from `sortIncidents`, or `SECTION_LABELS[key]`).
  - If the note has `replyTo`, that question becomes `answered`.
  - If the note has `answersGapId`, that gap becomes `answered` with `answeredByNoteId`.
- **Also export** `sortIncidents(shift: Shift): Incident[]`: by `minutesFromShiftStart` of the time, untimed incidents last by `createdAt`. Display number = index + 1.

- [ ] **Step 1: Write the failing tests** in `operations.test.ts`. Build fixtures with a counter `IdGen` and a fixed `now = '2026-11-09T01:00:00.000Z'`. Test names and the key assertions:
  - `addIncident creates ai-owned fields and copies note attachments`
  - `addIncident clears noIncidentsConfirmed`
  - `updateIncident skips manager-owned fields` (location set by the manager stays as "Bar główny")
  - `appendToIncident appends to ai description and adds a new block after a manager block`
  - `appendToSection creates the section and never edits existing blocks`
  - `setSummary is ignored when the summary has a manager block`
  - `addGap deduplicates identical open gaps`
  - `unknown incidentId is skipped and the note is still processed`
  - `routedTo lists applied targets in order` (expect `['Incydent #1', 'Usterki i sprzęt']`)
  - `replyTo note marks its question answered; answersGapId note marks its gap answered`
  - `sortIncidents orders after-midnight times after evening times`
  - `does not mutate the input shift`
  - `OperationsResponseSchema rejects an unknown op`
- [ ] **Step 2:** Run `npx vitest run tests/unit/operations.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `ids.ts` and `operations.ts`.
- [ ] **Step 4:** Run the tests and expect PASS. Then run `npm run check`.
- [ ] **Step 5: Commit** with `feat(report): operation schema and applyOperations merge rules`, then open the PR.

---

### Task 4: Gaps

**Files:**
- Create: `lib/report/gaps.ts`
- Test: `tests/unit/gaps.test.ts`

**Interfaces:**
- Consumes: Tasks 2 and 3.
- Produces:
  - `type DerivedGap = { id: string; target: GapTarget | { kind: 'report' }; question: string; weight: 'required' | 'optional'; origin: 'rule' | 'ai'; suggestion?: Gap['suggestion'] }`
  - `ruleGaps(shift: Shift): DerivedGap[]`
  - `openGaps(shift: Shift): DerivedGap[]`: rule gaps plus AI gaps with `status==='open'`.
  - `requiredCount(shift: Shift): number`
  - `fieldGap(shift: Shift, incidentId: string, field: 'type'|'time'|'location'|'description'): DerivedGap | undefined`

**Rules (spec §4.6 and §6.3):**
- **For each incident:** a missing type, location or description, or a missing or `approx` time, produces `required`.
  - id: `rule:<incidentId>:<field>`
  - question: from `INCIDENT_FIELD_QUESTIONS`
  - A description counts as missing when it's null or `isDocEmpty`.
- **No incidents and `!noIncidentsConfirmed`:** `required`, id `rule:no-incidents`, question "Potwierdź: brak incydentów".
- **Each empty or missing section in** `['audience','security','maintenance']`: `optional`, id `rule:empty:<key>`, question = `EMPTY_SECTION_PROMPTS[key]`.
- **Only AI gaps** whose `status === 'open'` are included. AI gaps with `target.field` resolve automatically when that field is non-null, so exclude them in `openGaps`.

- [ ] **Step 1: Write failing tests.**
  - `approx time yields a required rule gap`
  - `missing location yields "Gdzie?"`
  - `no incidents requires confirmation until noIncidentsConfirmed`
  - `empty security section yields an optional gap; a section with content does not`
  - `answered AI gaps are excluded`
  - `AI field gap disappears once the field has a value`
  - `requiredCount counts only required gaps`
- [ ] **Step 2:** Run `npx vitest run tests/unit/gaps.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `gaps.ts`.
- [ ] **Step 4:** Run the tests and expect PASS. Then run `npm run check`.
- [ ] **Step 5: Commit** with `feat(report): derived gaps and required count`, then open the PR.

---

### Task 5: Demo seed and empty shift

**Files:**
- Create: `lib/report/seed.ts`
- Test: `tests/unit/seed.test.ts`

**Interfaces:**
- Consumes: `applyOperations`, `requiredCount` and `openGaps`.
- Produces:
  - `createEmptyShift(now: Date, newId: IdGen): Shift`
    - `startedAt` = now
    - `date` = the local YYYY-MM-DD, or yesterday's date when the local hour is < 6
    - `authorId` = 'kasia'
    - `noIncidentsConfirmed` = false
  - `createDemoShift(): Shift`
    - **Deterministic:** fixed ids, `startedAt` 2026-11-08 20:00 local, `date` '2026-11-08'.
    - **Built by** running `applyOperations` over `DEMO_NOTES` and per-note `DEMO_OPS`. No AI call.

**Demo content** (from the canvas "v2" frames and spec §4.8). Note texts are verbatim from the canvas journal:

| Time | Note | Operations |
|---|---|---|
| 21:15 | "kolejka ok. 40 min do 22:30, urodziny w loży VIP, 12 osób" | appendToSection `audience` "Duży ruch, kolejka do ok. 40 min do 22:30."; appendToSection `privateEvents` "Urodziny w loży VIP, 12 osób." |
| 22:41 | "bijatyka przy barze głównym, ochrona wyprowadziła 2 os., jeden z rozciętą wargą" with attachment `IMG_2231.jpg` (image) | addIncident Bójka, 22:40, Bar główny, "Dwie osoby wyprowadzone przez ochronę. Jedna osoba z rozciętą wargą — opatrzona przez ochronę na miejscu, odmówiła karetki."; addGap required "Czy wezwano policję?"; addGap optional "Czy ktoś z ochrony był świadkiem?" |
| 00:30 | "kran nr 3 cieknie, trzeba zgłosić serwis" | appendToSection `maintenance` "Cieknie kran piwny nr 3." |
| 01:30 | "koło 1 dziewczyna zasłabła w toalecie, karetka zabrała ją 1:25" | addIncident "Zasłabnięcie / pomoc medyczna", `{hhmm:'01:00', approx:true, sourcePhrase:'koło 1'}`, "Toaleta męska", "Gość zasłabł w toalecie. Karetka zabrała go o 01:25."; addGap required "Kto udzielił pierwszej pomocy?" |
| 01:48 | "znowu ten typ z wczoraj przy szatni, ogarnięte" | askQuestion "Nie jestem pewien, co się stało przy szatni. Czy to był incydent?" with options ["Tak, zapisz jako incydent", "Nie, tylko informacja"] |
| 02:52 | "zamykamy, wyjście sprawne, bez kolejek do szatni" | appendToSection `audience` "Wyjście sprawne, bez kolejek do szatni."; setSummary ["Pełna sala, kolejka do ok. 22:30. Dwa incydenty: bójka przy barze (22:40) i zasłabnięcie gościa (ok. 01:00). Usterka kranu nr 3. Zamknięcie sprawne."] |

- [ ] **Step 1: Write failing tests.**
  - `demo shift has 2 incidents sorted Bójka then Zasłabnięcie`
  - `demo shift requiredCount is 3` (police, first aid, exact time)
  - `demo shift has one open question attached to the 01:48 note`
  - `demo shift optional gaps include rule:empty:security and the witness gap`
  - `createDemoShift is deterministic` (deep-equal across two calls)
  - `createEmptyShift at 02:30 uses the previous calendar date`
- [ ] **Step 2:** Run `npx vitest run tests/unit/seed.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `seed.ts`.
- [ ] **Step 4:** Run the tests and expect PASS. Then run `npm run check`.
- [ ] **Step 5: Commit** with `feat(report): deterministic demo shift and empty shift`, then open the PR.

---

### Task 6: Shift store

**Files:**
- Create: `store/shift.ts`, `lib/ai/client.ts` (the fetch wrapper only. The route is Task 7.)
- Test: `tests/unit/store.test.ts` (mock `@/lib/ai/client` with `vi.mock`)

**Interfaces:**
- **Consumes:** Tasks 2–5.
- **Produces (`lib/ai/client.ts`):**
  - `type AiContext` (spec §6.1 snapshot): `{ shiftDate: string; startHHMM: string; nowHHMM: string; incidents: Array<{ id: string; number: number; type?: string; time?: EventTime; location?: string; description: string; managerFields: string[] }>; sections: Array<{ key: SectionKey; text: string; hasManagerBlocks: boolean }>; openGaps: Array<{ id: string; question: string; target: GapTarget | { kind: 'report' } }>; openQuestions: Array<{ id: string; question: string }>; answeringGap?: { id: string; question: string; target: GapTarget | { kind: 'report' } } }`
  - `buildContext(shift: Shift, note: Note, now: Date): AiContext`
  - `requestOperations(note: Note, context: AiContext): Promise<{ operations: Operation[]; source: 'ai' | 'fallback' }>`: POSTs `/api/process-note` and throws on a non-200 response.
- **Produces (`store/shift.ts`):** `useShift`, a Zustand store with `persist` (key `lawka:v1`, `version: 1`).
  - **State:** `{ shift: Shift; tab: 'journal' | 'report'; lastRemoved?: { incident: Incident; index: number } }`
  - **Notes:**
    - `submitNote(text: string, attachments: Attachment[], opts?: { replyTo?: string; answersGapId?: string }): Promise<void>`
      - Trims the text and returns early if it's empty and there are no attachments.
      - Appends a `pending` note. If `answersGapId` is set, it marks that gap answered at once.
      - Calls `requestOperations`. On success it runs `applyOperations` with `crypto.randomUUID`. On error the note becomes `failed`.
      - **If `shift.sentAt` is set when the response arrives, it ignores the result.**
    - `retryNote(noteId: string): Promise<void>`
  - **Header and incidents:**
    - `setTab(tab)`, `setDate(date: string)`, `setAuthor(personId: string)`
    - `setIncidentField(incidentId, field: 'type'|'time'|'location', value: string | EventTime)`: the value becomes a manager-owned `Field`.
    - `setIncidentDescription(incidentId, doc: RichDoc)`
    - `addEmptyIncident(): string`
    - `duplicateIncident(incidentId): void`: inserts the copy after the original, with all fields manager-owned.
    - `removeIncident(incidentId): void` and `undoRemove(): void`
    - `confirmNoIncidents(): void`
  - **Sections and gaps:**
    - `setSectionDoc(key: SectionKey, doc: RichDoc)`
    - `addSection(key: SectionKey): void`
    - `confirmNoRemarks(key: SectionKey): void`: appends a manager paragraph "Bez uwag."
    - `dismissGap(gapId)`: optional AI gaps only.
  - **Lifecycle:** `send(now?: Date): void` (sets `sentAt`), `newShift(): void`, `loadDemo(): void`
  - **Initial state:** `createDemoShift()`, `tab: 'journal'`.
  - **Migrate and rehydrate:** if the persisted data isn't version 1, or fails a light shape check (`shift.notes` is an array), reset to the demo.
  - **Every action is a no-op when `shift.sentAt` is set**, except `newShift`, `loadDemo` and `setTab`.

- [ ] **Step 1: Write failing tests** (Node env; give the `persist` storage an in-memory `localStorage` shim):
  - `submitNote ignores whitespace-only text`
  - `submitNote adds a pending note then applies returned operations`
  - `submitNote marks the note failed when requestOperations rejects`
  - `retryNote re-requests and processes a failed note`
  - `results arriving after send() are ignored`
  - `answering a gap marks it answered immediately and links the note`
  - `setIncidentField makes the field manager-owned so a later updateIncident cannot overwrite it`
  - `removeIncident then undoRemove restores the incident at the same index`
  - `confirmNoIncidents removes the rule:no-incidents gap`
  - `confirmNoRemarks writes "Bez uwag." as a manager block`
  - `corrupt persisted JSON falls back to the demo shift`
  - `actions are no-ops after send() except newShift/loadDemo/setTab`
  - `buildContext lists manager-owned fields per incident` (a pure test of `client.ts`, without fetch)
- [ ] **Step 2:** Run `npx vitest run tests/unit/store.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `lib/ai/client.ts` and `store/shift.ts`.
- [ ] **Step 4:** Run the tests and expect PASS. Then run `npm run check`.
- [ ] **Step 5: Commit** with `feat(store): persisted shift store with note pipeline actions`, then open the PR.

---

### Task 7: AI route, prompt, fallback and model choice

**Files:**
- Create:
  - `lib/ai/model.ts`
  - `lib/ai/prompt.ts`
  - `lib/ai/fallback.ts`
  - `app/api/process-note/route.ts`
  - `scripts/measure-models.ts`
- Test: `tests/unit/fallback.test.ts`, `tests/unit/prompt.test.ts`

**Interfaces:**
- Consumes: `OperationsResponseSchema`, `AiContext`, `Note` and the catalog.
- Produces:
  - **`model.ts`:** `export const MODEL_ID = 'gemini-3.8-flash'` (updated in Step 5 if a faster model wins).
  - **`prompt.ts`:** `buildSystemPrompt(): string` and `buildUserPrompt(note: Note, context: AiContext): string`.
  - **`fallback.ts`:** `fallbackOperations(note: Note, context: AiContext): Operation[] | null`
  - **Route:**
    - `POST /api/process-note`, body `{ note: Note; context: AiContext }`
    - success → 200 `{ operations, source }`
    - invalid body → 400
    - Gemini fails and the fallback returns null → 422 `{ error: 'unprocessable' }`
    - Use the AI SDK's structured-output API **as documented in the installed `ai` version** with `OperationsResponseSchema`, and a 20 s abort (`AbortSignal.timeout(20000)`).

**Prompt content (spec §6.4).**
- Instructions are in English, output text in Polish. The prompt must state:
  - the section keys with their Polish labels and one-line meanings
  - the incident types and venue areas (prefer them; free text is allowed)
  - the incident minimums
  - the weighting rules:
    - required: injury → help given, violence or theft → police, medical → first aid
    - optional: precise sub-location, witnesses, evidence
  - only `askQuestion` when the note can't be classified
  - never invent facts
  - set `approx: true` and `sourcePhrase` for vague times
  - when `answeringGap` is present, emit `appendToIncident` or `appendToSection` with **one natural Polish sentence** combining the question and the answer, plus `resolveGap`
  - corrections like "incydent 2 był o 01:05" map to `updateIncident` on incident number 2's id
  - keep `setSummary` to 2–4 sentences
- `buildUserPrompt` includes the note text, its HH:MM and the JSON context.

**Fallback rules:**
- `answeringGap` set → `appendToIncident` (or `appendToSection`) with "`<question>` `<answer>`." plus `resolveGap`.
- The note text normalized contains any of `bojk|bil|bijatyk|awantur` → addIncident "Bójka"; `kradz|ukradl` → "Kradzież"; `zaslabl|karetk|omdl` → "Zasłabnięcie / pomoc medyczna".
  - The time is taken from the first `parseHHMM`-able token, otherwise the note's time with `approx: true`.
  - The description is the raw note text.
- Otherwise `null`.

- [ ] **Step 1: Write failing tests.**
  - `fallback: "awantura na bramce 23:10" → addIncident Bójka at 23:10`
  - `fallback: gap answer appends "Czy wezwano policję? Nie." and resolves the gap`
  - `fallback: unrelated text returns null`
  - `prompt: system prompt lists every SECTION_LABELS value and every INCIDENT_TYPES entry`
  - `prompt: user prompt contains the note text and context JSON`
- [ ] **Step 2:** Run `npx vitest run tests/unit/fallback.test.ts tests/unit/prompt.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `model.ts`, `prompt.ts`, `fallback.ts` and `route.ts`. The route tries Gemini first and then the fallback, and logs only error types (never the key or the prompt).
- [ ] **Step 4:** Run the tests and expect PASS. Then run `npm run check`.
- [ ] **Step 5: Measure the models.**
  - `scripts/measure-models.ts` (run with `npx tsx --env-file=.env.local scripts/measure-models.ts`) sends the 3 messy Polish notes below to `gemini-3.8-flash`, `gemini-3.5-flash-lite` and `gemini-3.1-flash-lite` through the same `buildSystemPrompt`/schema. It prints latency and whether the schema parsed.
  - Set `MODEL_ID` to the fastest model that parsed all 3 and produced sensible Polish. Record the numbers in the PR body.
  - Notes:
    - "23:10 awantura na bramce, nie wpuściliśmy 3 os., jeden groził ochroniarzowi"
    - "spokojnie, bar zamknięty 2:40, zabrakło limonek"
    - "dj spóźnił się 20 min, sprzęt ok"
- [ ] **Step 6: Manual check.** With `npm run dev`, run `curl -s -X POST localhost:3000/api/process-note -H 'content-type: application/json' -d @<fixture>` using a fixture built from `createDemoShift()`. Expected: 200 with operations.
- [ ] **Step 7: Commit** with `feat(ai): process-note route with Gemini structured output and fallback`, then open the PR.

---

### Task 8: App shell, journal and input

**Files:**
- Create:
  - `components/shift/app-header.tsx`
  - `components/journal/journal.tsx`
  - `components/journal/journal-entry.tsx`
  - `components/journal/ai-question-card.tsx`
  - `components/composer/composer.tsx`
  - `components/composer/fake-attach.ts`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `useShift`, `requiredCount`, `sortIncidents` and `formatHHMM`.
- Produces:
  - `<AppHeader />`
  - `<Journal />`
  - `<Composer placeholder: string />`
  - `<AiQuestionCard />`
  - `pickFakeAttachment(): Attachment`: cycles through `IMG_2232.jpg` (image), `nagranie.mp4` (video) and `protokol.pdf` (document).

**Behaviour (spec §4.1 and §4.2, canvas v2 frames):**
- **Page:** a single column. The header sits at the top, the tab content in the middle (journal max-w 720 px, report max-w 760 px, both centred), and the question card plus input are pinned at the bottom.
  - The `Raport` tab content is a placeholder `<ReportDocument />` stub that renders "Raport ze zmiany" until Task 9.
- **Header:**
  - "Wróć" is a ghost button that does nothing.
  - Status: "Zmiana trwa · od HH:MM", or "Zmiana zamknięta" after `sentAt`.
  - shadcn Tabs: "Dziennik zmiany" (just "Dziennik" below 640 px) and "Raport", plus an amber badge with `requiredCount` when it's above 0.
  - Primary button: "Zamknij zmianę" on the journal tab (`setTab('report')`), "Wyślij raport" on the report tab (wired to the dialog in Task 11).
  - On phones the tabs span the full width on their own row.
- **Journal entries:**
  - The time column, text and attachment chips.
  - Status line:
    - processed → muted "→ " + `routedTo.join(' · ')`
    - pending → spinner and "porządkuję…"
    - failed → "Nie udało się uporządkować" plus a "Ponów" link button (`retryNote`)
    - an open question on the note → amber "czeka na Twoją odpowiedź ↓"
  - Auto-scroll to the newest entry.
- **AI question card:**
  - Shows the oldest open question: "Pytanie do notatki z HH:MM · " + the question.
  - Option buttons call `submitNote(option, [], { replyTo })`.
  - The hint reads "…albo odpowiedz poniżej". While the card is open, the input's submit passes `replyTo`.
- **Composer:**
  - Textarea. Enter submits, Shift+Enter adds a new line.
  - 📎 adds a `pickFakeAttachment()` chip, removable with ×. The 🎤 slot is reserved for Task 13 and renders nothing yet.
  - "Dodaj ↵" is disabled when the text is empty and there are no attachments.
  - Placeholders come from spec §4.2 depending on the tab.
  - On the Raport tab, a successful submit shows the toast "Dodano do dziennika".
- **Phone:** after a note is processed, show "Zapisano jako <first routedTo> · HH:MM" with a check icon above the input for 4 s.

- [ ] **Step 1: Implement** the components and the page.
- [ ] **Step 2:** Run `npm run check` and `npm run build`. Expected: green.
- [ ] **Step 3: Manual check.**
  - With `npm run dev`, use the `run` skill (or Playwright) to take screenshots at 1280×900 and 390×844.
  - Compare them with the canvas frames "v2 · Dziennik zmiany (desktop)" and "v2 · Dziennik (telefon)".
  - Add the note "23:10 awantura na bramce" and confirm it goes pending → "→ Incydent #3".
- [ ] **Step 4: Commit** with `feat(ui): app shell with tabs, journal and composer`, then open the PR.

---

### Task 9: Report document: header, sections and rich editor

**Files:**
- Create:
  - `components/report/report-document.tsx`
  - `components/report/report-properties.tsx`
  - `components/report/rich-editor.tsx`
  - `components/report/block-authorship.ts`
  - `components/report/section-block.tsx`
  - `components/report/section-hints.tsx`
- Test: `tests/unit/block-authorship.test.ts` (jsdom env via `// @vitest-environment jsdom`)

**Interfaces:**
- Consumes: the store, `catalog`, `rich.ts`, `openGaps` and `PEOPLE`.
- Produces:
  - `<ReportDocument />` (replaces the Task 8 stub)
  - `<RichEditor doc: RichDoc; onChange(doc: RichDoc): void; editable: boolean; placeholder?: string />`
  - `BlockAuthorship`: a Tiptap extension. It adds attrs `by`, `at` and `sourceNoteIds` to `paragraph` and `bulletList`, and an `appendTransaction` that sets `by:'manager', at:new Date().toISOString()` on every top-level block touched by a doc-changing transaction from the user (skip transactions with meta `external: true`).

**Behaviour (spec §4.3 and §4.5):**
- **Title and properties:** "Raport ze zmiany" as an `h1`, followed by a Notion-style properties `dl`:
  - **"Data zmiany"** (calendar icon): a shadcn Popover with Calendar. The label reads "pt, 8 lis 2026 → sob, 9 lis" (Intl `pl-PL` short weekday and month, with the next day after the arrow).
  - **"Autor"** (user icon): a DropdownMenu of `PEOPLE` with avatar initials coloured by `tone`, name and role.
  - A divider underneath.
- **Order:**
  1. Podsumowanie
  2. Incydenty (a slot for the Task 10 component, rendered from `components/report/incidents.tsx`, which Task 10 creates. Until then, render `null` behind a placeholder export.)
  3. Publiczność i bezpieczeństwo
  4. Ochrona
  5. Usterki i sprzęt
  6. Any present conditional sections, in `CONDITIONAL_SECTIONS` order
  7. `<SectionHints />`
- **Section block:** an `h3` label plus a `RichEditor`.
  - **An empty fixed section** shows the muted `EMPTY_SECTION_PROMPTS[key]` and a dashed "Bez uwag" button (`confirmNoRemarks`).
  - **Podsumowanie, when empty**, shows a muted "Podsumowanie pojawi się po pierwszych notatkach.".
- **RichEditor:**
  - StarterKit restricted to paragraph, text, bold, italic, bulletList and listItem (disable headings, code, blockquote and so on). Default shortcuts. No toolbar.
  - **Sync rule:** when `doc` changes from outside while the editor is **not focused**, call `setContent` with meta `external: true`. While focused, **defer until blur**.
  - Calls `onChange` on update (debounced 300 ms).
- **Section hints:**
  - The muted "Często w raportach:" label.
  - The first 5 of `HINT_ORDER` that aren't present, as dashed pill buttons "+ <label>" (with `HINT_LABEL_OVERRIDES`).
  - "+ N więcej" expands the rest.
  - Clicking a hint calls `addSection(key)` and focuses the new editor.
- **Read-only after `sentAt`:** editors are non-editable and buttons hidden.

- [ ] **Step 1: Write the failing test** `block-authorship.test.ts`:
  - Create a headless Tiptap `Editor` with `BlockAuthorship` and content of 2 `ai` paragraphs.
  - Insert text into the 2nd paragraph. The 2nd becomes `by:'manager'` and the 1st stays `ai`.
  - A `setContent` with meta `external: true` keeps the attrs from the given JSON.
- [ ] **Step 2:** Run `npx vitest run tests/unit/block-authorship.test.ts` (extend the vitest `include`/environment config if needed). Expected: FAIL.
- [ ] **Step 3: Implement** the extension, the editor and the components.
- [ ] **Step 4:** Run the tests and expect PASS. Then run `npm run check` and `npm run build`.
- [ ] **Step 5: Manual check.** Screenshot the Raport tab at 1280 and 390 wide and compare with "v2 · Raport (desktop)". Type in Ochrona, reload the page, and confirm the text persisted.
- [ ] **Step 6: Commit** with `feat(ui): report document with properties, section editors, hints`, then open the PR.

---

### Task 10: Incidents in the report

**Files:**
- Create:
  - `components/report/incidents.tsx`
  - `components/report/incident-block.tsx`
  - `components/report/inline-field.tsx`
  - `components/report/type-picker.tsx`
  - `components/report/time-picker.tsx`
  - `components/report/place-picker.tsx`
  - `components/report/incident-menu.tsx`
  - `components/report/gap-chip.tsx`

**Interfaces:**
- Consumes: the store actions from Task 6, `sortIncidents`, `fieldGap`, `openGaps`, `matches` and `parseHHMM`.
- Produces: `<Incidents />`, which mounts into the slot from Task 9.

**Behaviour (spec §4.4 and §4.6, canvas frames "1 · Notes feed…" and "1 · Open states"):**
- **Heading row:** "Incydenty" with a quiet "+ Dodaj incydent" button on the right (`addEmptyIncident`).
- **No incidents:** "Nie zgłoszono żadnych incydentów." plus an amber "Potwierdź: brak incydentów" button (`confirmNoIncidents`). Once confirmed, show the paragraph "Brak incydentów w trakcie zmiany.".
- **Incident block:** bordered, in `sortIncidents` order.
  - **Header line:** `#N` + `<InlineField>` type · time · place.
    - An `InlineField` is plain text with a 1 px dashed underline. It opens a Popover.
    - An empty value shows the amber placeholder "typ", "godzina" or "miejsce".
    - An `approx` time shows as an amber "? HH:MM" with a Tooltip: "W notatce: „<sourcePhrase>". Sprecyzuj, jaka była dokładna godzina zdarzenia." (or "Sprecyzuj, jaka była dokładna godzina zdarzenia." when there's no sourcePhrase).
- **Right side of the header:** "dodano o HH:MM" (from `createdAt`). On hover or focus-within it becomes a ⋯ DropdownMenu:
  - "Duplikuj" (`duplicateIncident`)
  - "Usuń" in red (`removeIncident`, then a sonner toast "Usunięto incydent" with the action "Cofnij" → `undoRemove`, for 8 s)
  - a muted footer "dodano o HH:MM"
- **Type picker:** a Popover with a Command (search input at the top). It filters `INCIDENT_TYPES` with `matches()`, bolds the matched part, and the last item is "+ Użyj „<query>" jako własnego typu".
- **Time picker:** a Popover with a text input (`parseHHMM` validation, error "Podaj godzinę, np. 01:05") and a scrollable list in 5-minute steps, starting from the shift start and wrapping past midnight. Saving sets `{ hhmm, approx: false }`.
- **Place picker:** a Popover with a Command over `VENUE_AREAS` plus "Inne…" (switches to free-text input).
- **Body:** `<RichEditor>` for the description (`setIncidentDescription`), attachment chips, then the gap chips.
- **Gap chips:** the AI gaps targeting this incident without a field.
  - required → amber fill. optional → dashed and muted, with × (`dismissGap`).
  - Clicking opens a Popover with a one-line input pre-filled with `suggestion?.value`. Saving calls `submitNote(answer, [], { answersGapId })`.
  - Field gaps are **not** chips. They're the amber placeholders and "?" above.
- **Read-only after `sentAt`:** no popovers or menu. Unresolved required fields render as "brak danych".

- [ ] **Step 1: Implement** the components.
- [ ] **Step 2:** Run `npm run check` and `npm run build`. Expected: green.
- [ ] **Step 3: Manual check** in `npm run dev`:
  - Type "boj" in the type picker and "Bójka" is offered.
  - "toal" offers both toilets.
  - Set a time of 01:05 on incident #2: the "?" disappears and the badge drops to 2.
  - Duplicate, then remove, then "Cofnij" restores it.
  - Answer "Czy wezwano policję?" with "Nie": the chip disappears and, after processing, a sentence appears in the description.
  - Take screenshots at 1280 and 390.
- [ ] **Step 4: Commit** with `feat(ui): incident blocks with inline pickers, gap chips and actions`, then open the PR.

---

### Task 11: Sending, read-only state and demo controls

**Files:**
- Create: `components/shift/send-dialog.tsx`, `components/shift/sent-banner.tsx`, `components/shift/demo-menu.tsx`
- Modify: `components/shift/app-header.tsx` and `components/report/report-document.tsx`

**Interfaces:**
- Consumes: `openGaps`, `requiredCount`, `send`, `newShift`, `loadDemo` and `setTab`.

**Behaviour (spec §4.7 and §4.8):**
- **"Wyślij raport"** opens a Dialog.
  - **No required gaps:** title "Raport kompletny. Wysłać?" and button [Wyślij].
  - **Otherwise:** a list of the required gaps. Each item scrolls to and focuses its target (element ids `incident-<id>` and `section-<key>`). Buttons: [Uzupełnij] (default, closes the dialog) and [Wyślij mimo to].
- **After `send()`:**
  - The `SentBanner` at the top of the report reads "Wysłano HH:MM" with a "Nowa zmiana" button (`newShift`).
  - The header status becomes "Zmiana zamknięta".
  - The input is hidden.
- **Demo menu:** a small ghost DropdownMenu in the header's left group, labelled "Demo", with "Załaduj ponownie" (`loadDemo`) and "Pusta zmiana" (`newShift`).

- [ ] **Step 1: Implement.**
- [ ] **Step 2:** Run `npm run check` and `npm run build`. Expected: green.
- [ ] **Step 3: Manual check.**
  - With the demo loaded, "Wyślij raport" lists 3 gaps.
  - Clicking "Dokładna godzina?" focuses incident #2's time.
  - "Wyślij mimo to" gives a read-only view with "brak danych" on the time.
  - "Nowa zmiana" gives an empty journal and the badge shows 1 (the no-incidents confirmation).
- [ ] **Step 4: Commit** with `feat(ui): send review dialog, read-only report, demo menu`, then open the PR.

---

### Task 12: End-to-end test, README and production check

**Files:**
- Create: `tests/e2e/shift-report.spec.ts` and `tests/e2e/fixtures.ts` (it mocks `/api/process-note` with `page.route`, returning fixed operations per note text)
- Modify: `README.md`

- [ ] **Step 1: Write the e2e spec,** following the flow in spec §8. Assertions:
  - The badge reads 3 after the demo loads.
  - The new note "23:10 awantura na bramce" shows "→ Incydent #3".
  - Answering the question card with "Nie, tylko informacja" removes the card.
  - The Raport tab shows 3 incident blocks.
  - Answering "Czy wezwano policję?" removes that chip.
  - "Bez uwag" on Ochrona shows "Bez uwag.".
  - Duplicate makes 4 incidents. Remove makes 3. Cofnij makes 4 again.
  - "Wyślij raport" → "Wyślij mimo to" → "Wysłano" is visible and "brak danych" is visible.
  - Run it in both projects (Desktop Chrome and Pixel 7).
- [ ] **Step 2:** Run `npm run test:e2e`. Expected: PASS in both projects.
- [ ] **Step 3: README** (English, short):
  - what it is and who it's for
  - **the live link**
  - how to run it (`npm i`, `.env.local` from `.env.example`, `npm run dev`)
  - the key decisions (summarise spec §2 in 8 bullets)
  - how the AI works (operations, manual edits win, fallback)
  - "Co dalej": owner inbox and history, PDF/insurer export, rating fields, real uploads
  - a link to the spec and the canvas
- [ ] **Step 4: Production check.**
  - After merging, open the Vercel production URL.
  - Add 3 messy Polish notes through the **real** AI (spec §8, manual) and confirm they're processed.
  - Note any failures in the PR. Fix them now or list them.
- [ ] **Step 5: Commit** with `test(e2e): full shift flow; docs: README`, then open the PR.

---

### Task 13 (stretch, cut first): Voice dictation

**Files:**
- Create: `components/composer/use-speech.ts`
- Modify: `components/composer/composer.tsx`

**Interfaces:**
- Produces: `useSpeech(): { supported: boolean; listening: boolean; start(onText: (t: string) => void): void; stop(): void }`, using `window.SpeechRecognition ?? window.webkitSpeechRecognition` with `lang 'pl-PL'`, `interimResults: true`.

**Behaviour (D16):**
- The 🎤 button is rendered only when `supported`. While listening it's highlighted, with `aria-pressed`.
- Recognised text is appended to the textarea and **never sent automatically**.
- Clicking again stops it.

- [ ] **Step 1: Implement.**
- [ ] **Step 2:** Run `npm run check` and `npm run build`.
- [ ] **Step 3: Manual check** in Chrome: dictate "dwudziesta trzecia dziesięć awantura na bramce" and confirm it lands in the input. In a browser without support, the 🎤 button is absent.
- [ ] **Step 4: Commit** with `feat(composer): voice dictation via Web Speech API`, then open the PR.
