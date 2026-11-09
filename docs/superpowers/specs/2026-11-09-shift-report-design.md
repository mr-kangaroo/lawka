# Ławka — Shift Report (Raport ze zmiany) — Design Spec

- **Date:** 2026-11-09
- **Status:** Draft v2, awaiting review
- **Brief:** Notion "🪡 Zadanie na ławce" (wearetonik)
- **Visual reference:** [design canvas](https://claude.ai/artifact/3jojprCgVBaPsRuMua5Ykm), frame **"1 · Notes feed + report as a document (chosen)"** plus the phone frame. Options 2 and 3 on the canvas were rejected and are kept only for comparison.
- **Timebox:** 8 hours total, including this spec

---

## 1. Goal

A bar or club manager produces a **complete, legally defensible shift report in under 10 minutes**, without it feeling like paperwork. After opening the tool they should think: *"This is faster than what I did before, and I didn't forget anything."*

The deliverables are a **clickable, deployed prototype** (link) and a **public GitHub repo**. The aim is creative direction, not pixel perfection.

### Users
- **Primary:** experienced shift managers, tired. They write quick notes on a **phone during the shift** and close the shift on a **laptop at around 3 a.m.**
- **Secondary:** owners and operators, who read reports. We don't design for them here, but the data model must not block them later (§2, D3).

### Scope boundary
The brief covers **creating one report only**. Reading, collecting, listing or exporting reports belongs to other flows and is out of scope.

### Success criteria for the prototype
1. A reviewer opens the link and understands the flow without explanation.
2. Free text goes in and a structured report comes out. The AI's help is visible and useful, never in the way.
3. Incidents are recorded close to the moment they happen, with evidence chips attached.
4. Missing required details are obvious. Missing nice-to-have details are visible but quiet.
5. A shift can be closed with gaps, because we don't demand perfection, and the report records those gaps honestly.

---

## 2. Decisions log

| # | Decision | Why |
|---|----------|-----|
| D1 | **One live report per shift**, open all night: quick notes during the shift plus the close at 3 a.m. on one screen. | Answers "incidents recorded close to the moment" without adding a second flow. |
| D2 | **Layout: a notes feed (left) next to the report (right).** On a phone the two become tabs. | Resolves the brief's tension between guided and free text without a mode choice. Latency doesn't block the manager. |
| D3 | **Structured underneath, a document on the surface.** The report looks and edits like one document, but the data stays structured. There are fixed fields (date, author), **fixed section headings** that can't be renamed, deleted or invented, **incidents as structured records**, and rich text only *inside* sections. Stored as JSON keyed by section, never as one markdown blob. | Evidence for compliance needs consistency, validation and queryable data. The manager needs it to not feel like a form. |
| D4 | **Each section has its own small rich-text editor** (Tiptap: bold, italic, bullet list), styled so the sections read as one continuous document. There is **no formatting toolbar**: formatting is by keyboard shortcuts and markdown-style typing (see §4.5). | Simpler and safer than one editor for the whole report: the structure can't break, the AI writes into a known place, and authorship is tracked per paragraph. |
| D5 | **The AI asks questions inside the feed**, under the unclear note, with quick replies and a short text field. It only asks when it can't classify a note. | A conversation without turning the app into a chat. |
| D6 | **Gaps have weight: `required`** (amber, counted in the header) **or `optional`** (grey dashed, not counted). | Not every gap matters equally. "Which toilet?" shouldn't nag. |
| D7 | **The legal minimum for incidents (type, time, place, description) is enforced by code.** The AI adds context-specific questions with a weight. | Legal requirements must be reliable and testable. |
| D8 | **Everything is editable in place. Manual edits always win.** The AI never changes text or a field the manager has touched. | Fixing text directly is faster than asking the AI. Trust. |
| D9 | **AI authorship is tracked but not shown.** No ✦ markers or "edited" labels. Working with the AI should feel seamless. Authorship and time are kept in the data for audit. | User feedback: the user knows the AI drafts the report, and the UI shouldn't keep saying so. |
| D10 | **The AI returns a list of operations, not a whole report.** | It can't silently drop content or edits. Small requests suit the free tier. Easy to unit-test. |
| D11 | **Notes are never changed or deleted.** | The night's record, for legal purposes. |
| D12 | **AI: Google Gemini free tier through the Vercel AI SDK, with a scripted fallback.** | Free, with no billing risk on a public link. Swapping provider is one line. The free tier returns 503s, so the fallback is required. |
| D13 | **UI in Polish.** Code, comments, commits and docs in English. | The users and the brief are Polish. Shows the AI handling Polish input. |
| D14 | **No backend.** State lives in localStorage. | 8-hour timebox. Refresh-safe at 3 a.m. |
| D15 | **Neutral shadcn theme, dark-first.** No branding. | Brief constraint. Design effort goes into the flow. |
| D16 | **No voice dictation.** | Dropped to pay for the editor work. Listed under "what's next". |

---

## 3. Scope

### In scope
- One screen with three states: shift running, closing with a review, and closed (read-only).
- **Header:** a "← Wróć" (back) button (placeholder with no action, standing for the app's home), "Start 20:00", a "Zmiana trwa" (shift in progress) pill, gap counts and "Zamknij zmianę" (close shift).
- **Notes feed:** text input, fake attachments (chips and placeholder thumbnails), timestamps, AI routing tags, AI questions, and pending/failed states.
- **Report:**
  - Fixed title, shift-date picker and author picker.
  - Incidents as structured blocks: searchable type, time picker, place picker, description, attachments, gap chips, Q&A lines, a hover menu with duplicate/remove, and "+ Dodaj incydent".
  - Sections with rich text.
  - A box suggesting sections not yet mentioned.
- AI processing of notes into operations, plus follow-up questions.
- Gap indicators, the header count and answering gaps in place.
- Close flow: review dialog → "close anyway" → locked report with the closing time.
- A seeded demo shift and a reset.
- Responsive: laptop with two columns, phone with tabs.

### Out of scope
- Other flows (from the brief): the owner/reader view, a list or history of reports, multiple venues, login, the app's home page (the back button is a placeholder).
- Real file handling (from the brief).
- Export, PDF, sending, notifications.
- Voice dictation, and rating fields for sections like "ocena bramkarzy" or "ocena baru" (door staff and bar ratings). Both go in the README under "Co dalej" (what's next).

---

## 4. UX

Copy below is Polish UI text. The English in parentheses is only for the reader of this spec.

### 4.1 Layout (laptop)

```
┌ [← Wróć] │ Start 20:00 · (● Zmiana trwa)              ⚠ 3 wymagane · 2 warto dodać   [Zamknij zmianę] ┐
├────────────── Notatki ──────────────┬──────────────────────── Raport ──────────────────────────────────┤
│ 21:15 note text                     │                                       ● wymagane  ◌ warto dodać     │
│       ✦ Publiczność · Imprezy pryw. │                                                                    │
│ 22:41 note text  [IMG_2231.jpg]     │ Raport ze zmiany                                                   │
│       ✦ Incydent #1                 │ 📅 Data zmiany   pt, 8 lis 2026 → sob, 9 lis  ·  👤 Autor  (KN) Kasia Nowak │
│ 01:48 unclear note                  │                                                                    │
│   ┌ ✦ AI question                ┐  │ Podsumowanie                                                        │
│   │ [Tak, zapisz jako incydent]  │  │ Pełna sala, kolejka do 22:30…                                       │
│   │ [Nie, tylko informacja]      │  │ Incydenty                                                           │
│   │ [ …albo dopisz, co się stało ]│ │ ┌ #1 [Bójka ⌕] [🕐 22:40 ▾] [📍 Bar główny ▾]        dodano o 22:41 ┐ │
│   └──────────────────────────────┘  │ │ description · Q—A lines · [IMG] · gap chips                      │ │
│ 02:52 note  ⟳ porządkuję…           │ └──────────────────────────────────────────────────────────────────┘ │
│ ┌ Nowa notatka…     📎 [Dodaj ↵] ┐  │ [+ Dodaj incydent]                                                  │
│ └───────────────────────────────┘   │ Publiczność / Imprezy prywatne / Usterki i sprzęt … (rich text)      │
│                                     │ ┌ ✦ Nic jeszcze o ochronie… [+ Ochrona] [+ Bar] [Zamknij] ┐         │
└─────────────────────────────────────┴────────────────────────────────────────────────────────────────────┘
```

**Phone:** **Notatki | Raport** become tabs, and the Raport tab label shows the required-gap count ("Raport · 1 luka", meaning one gap). The composer is pinned to the bottom with ≥44 px attach and send buttons. A short confirmation appears after a note is filed ("Zapisano jako Incydent #1 · 22:40", "saved as incident #1").

### 4.2 Notes feed
- **Each note** shows the time it was recorded (HH:MM), its text and its attachment chips.
- **Routing tag under processed notes:** a small ✦ plus the targets (for example "Incydent #1", or "Publiczność · Imprezy prywatne"). This is the only place AI work is labelled. It shows where a note went, not who wrote what.
- **Note states:**
  - `pending`: "porządkuję…" (organising) with a spinner.
  - `processed`: the routing tag.
  - `failed`: "Nie udało się uporządkować · [Ponów]" (couldn't organise · retry).
- **AI question:** a bordered block under its note with the question, 0–3 quick replies and a free-text reply field. Answering creates a new note linked to the question (`replyTo`), which is processed like any other note. The question then collapses to show the answer.
- **Composer:** Enter sends, Shift+Enter adds a new line. 📎 adds a fake file chip (a simulated picker shows a name and type, and images get a placeholder thumbnail).

### 4.3 Report: fixed header (Notion-style properties)
- **Title:** "Raport ze zmiany", large and not editable.
- Below it is a **properties block in the style of Notion**. Each row has an icon and a muted label in a fixed-width left column, and the value on the right as a borderless control that highlights on hover. A thin divider separates the block from the report body.
  - **Data zmiany** (shift date, calendar icon): the shift's **start date**, shown as "pt, 8 lis 2026 → sob, 9 lis" because shifts cross midnight. It uses a shadcn Popover with a Calendar and defaults to today, or yesterday when opened before 06:00.
  - **Autor** (author, person icon): avatar (initials) and name. It opens a list with avatar, name and role. Mock people:
    - Kasia Nowak, Kierowniczka zmiany (shift manager), the default
    - Tomek Wiśniewski, Kierownik zmiany (shift manager)
    - Ola Zielińska, Kierowniczka baru (bar manager)
    - Marek Dąbrowski, Szef ochrony (head of security)

### 4.4 Report: incidents
- Shown under **Incydenty** as bordered blocks, in time order. The display number (#1, #2, …) follows the order on screen.
- **Header row:**
  - **Type:** a **searchable combobox**. Typing filters a predefined list with the matches in bold. The last option is always "+ Użyj „<query>" jako własnego typu" (use the query as a custom type). Predefined types:
    - Bójka (fight)
    - Agresja słowna (verbal aggression)
    - Kradzież (theft)
    - Zasłabnięcie / pomoc medyczna (fainting / medical help)
    - Nietrzeźwość (drunkenness)
    - Narkotyki (drugs)
    - Molestowanie (harassment)
    - Uszkodzenie mienia (property damage)
    - Odmowa wejścia (refused entry)
    - Interwencja policji (police intervention)
    - Inne (other)
  - **Time:** a **dropdown time picker** (HH:MM in 5-minute steps, plus typing an exact time). An approximate time is shown in amber as "ok. 01:00" ("around 01:00").
  - **Place:** a **dropdown** of the venue's areas, plus "Inne…" (other) for free text:
    - Wejście / bramka (entrance / door)
    - Szatnia (cloakroom)
    - Bar główny (main bar)
    - Parkiet (dance floor)
    - Loża VIP (VIP booth)
    - Toalety (toilets)
    - Palarnia (smoking area)
    - Przed lokalem (outside the venue)
  - Right side: **"dodano o HH:MM"** (added at). **On hover or focus** this becomes a **⋯ button** opening a menu:
    - **Duplikuj (duplicate):** inserts a copy below. Its fields count as manager edits.
    - **Usuń (remove):** shown in red. Removes the incident and shows a toast, "Usunięto incydent · Cofnij" (incident removed · undo), for about 8 s. Source notes are never removed.
    - "dodano o HH:MM" stays visible as a muted footer of the menu.
- **Body:**
  - The description (plain multi-line text, edited in place).
  - Q&A lines from answered gaps ("Pomoc rannemu? — Opatrzony przez ochronę…", "help for the injured? — treated by security…").
  - Attachment chips.
  - Gap chips.
- **"+ Dodaj incydent"** (add incident, dashed button) below the last incident adds an empty incident. Its four required fields immediately show as required gaps.

### 4.5 Report: sections
- Fixed headings in the brief's order. **A section appears only when it has content.** Podsumowanie (summary) always appears once there's anything to summarise.
- The text inside a section is a Tiptap editor (paragraphs, **bold**, *italic*, bullet lists). Click anywhere to type. **No toolbar.** Formatting uses keyboard shortcuts only: **⌘/Ctrl+B** for bold, **⌘/Ctrl+I** for italic, and typing **"- "** or **"* "** at the start of a line (or **⌘/Ctrl+Shift+8**) for a bullet list. These are Tiptap's defaults, so there's no custom code. There are **no heading controls**, because headings are structure.
- **The suggestions box** sits at the end of the report and is dashed, not part of the report content. It names key sections that haven't been mentioned ("Nic jeszcze o ochronie, barze i stanach magazynowych", nothing yet on security, bar or stock):
  - "+ Ochrona" (security) / "+ Bar" / "+ Stany magazynowe" (stock) add that section with the cursor in it.
  - "Zamknij" dismisses the box for this shift.

### 4.6 Gaps
- **Chips:**
  - `required`: amber fill, bolder text.
  - `optional`: dashed grey outline, muted text.
  - A legend sits in a thin bar above the report, aligned right: "● wymagane · ◌ warto dodać" (required · worth adding).
- **Clicking a chip opens an inline answer field** in the incident or section, pre-filled with the AI's suggestion and a reason when one exists (for example "AI: w notatce „koło 1", zapisana 01:30 — popraw, jeśli wiesz dokładniej", meaning "the note says 'around 1', recorded at 01:30; correct it if you know better").
  - A gap tied to a field (time, place, …) writes that field.
  - A question gap ("Czy wezwano policję?", "were the police called?") stores the answer as a Q&A line.
- Optional chips can be dismissed (×). Required chips can only be answered, or left open and marked in the closed report.
- **Header:** "⚠ N wymagane" in amber, then "· M warto dodać" in muted grey.

### 4.7 Closing the shift
1. **"Zamknij zmianę" opens a review dialog.**
   - With no required gaps: "Raport kompletny. Zamknąć zmianę?" (report complete, close the shift?) → [Zamknij].
   - Otherwise it lists the required gaps (each one jumps to its place) with [Uzupełnij] (fill in, the default) and [Zamknij mimo to] (close anyway).
2. **The report becomes read-only.**
   - It shows "Zamknięto 03:07" (closed at 03:07).
   - Unresolved required gaps show as "brak danych" (no data).
   - Editors, chips and the composer are disabled or hidden.
   - "Nowa zmiana" (new shift) resets the app to an empty shift.

### 4.8 Demo
On first load the app starts with the shift begun at 20:00 and these notes **already processed** from stored operations (no AI call, so the first impression is instant):
- 21:15
- 22:41 with a photo chip
- 00:30
- 01:30
- 01:48, with an open AI question

A small "Demo" menu offers "Załaduj ponownie" (reload the demo) and "Pusta zmiana" (empty shift). New notes go to the live AI.

---

## 5. Data model

TypeScript sketch. The final version goes in `lib/report/types.ts`.

```ts
type ISO = string                          // ISO-8601 timestamp
type Author = 'ai' | 'manager'
type Provenance = { by: Author; at: ISO; sourceNoteIds: string[] }   // stored, never displayed (D9)
type Field<T> = { value: T; prov: Provenance }

type Attachment = { id: string; name: string; kind: 'image' | 'video' | 'document' } // fake

type Note = {
  id: string; createdAt: ISO; text: string; attachments: Attachment[]
  replyTo?: string                         // AiQuestion.id
  status: 'pending' | 'processed' | 'failed'
  routedTo: string[]                       // labels for the routing tag
}

type EventTime = { hhmm: string; approx: boolean }   // calendar date derived from shift date (after midnight → next day)

type QA = { gapId: string; question: string; answer: Field<string> }

type Incident = {
  id: string                               // stable; the AI references incidents by id
  createdAt: ISO                           // "dodano o"
  type: Field<string> | null               // predefined label or free text
  time: Field<EventTime> | null
  location: Field<string> | null           // predefined area or free text
  description: Field<string> | null
  qa: QA[]
  attachments: Attachment[]
  sourceNoteIds: string[]
}

type SectionKey =
  | 'summary' | 'audience' | 'security' | 'artists' | 'doorStaff' | 'production'
  | 'bar' | 'kitchen' | 'suppliers' | 'privateEvents' | 'maintenance' | 'stock'

// Section body = Tiptap/ProseMirror JSON restricted to: paragraph, bulletList, listItem, text, marks bold/italic.
// Every top-level block carries attrs { by: Author, at: ISO, sourceNoteIds: string[] }.
type BlockAttrs = { by: Author; at: ISO; sourceNoteIds: string[] }
type RichBlock =
  | { type: 'paragraph'; attrs: BlockAttrs; content?: RichInline[] }
  | { type: 'bulletList'; attrs: BlockAttrs; content: { type: 'listItem'; content: { type: 'paragraph'; content?: RichInline[] }[] }[] }
type RichInline = { type: 'text'; text: string; marks?: { type: 'bold' | 'italic' }[] }
type RichDoc = { type: 'doc'; content: RichBlock[] }
type Section = { key: SectionKey; doc: RichDoc; attachments: Attachment[] }

type GapTarget =
  | { kind: 'incident'; incidentId: string; field?: 'type' | 'time' | 'location' | 'description' }
  | { kind: 'section'; key: SectionKey }

type Gap = {                               // AI-origin gaps only; rule gaps are derived (§6.3)
  id: string; target: GapTarget; question: string
  weight: 'required' | 'optional'
  suggestion?: { value: string; reason: string }
  status: 'open' | 'answered' | 'dismissed'
}

type AiQuestion = { id: string; noteId: string; question: string; options: string[]; status: 'open' | 'answered' }

type Person = { id: string; name: string; role: string; initials: string }   // mock, in lib/report/people.ts

type Shift = {
  id: string
  date: string                             // YYYY-MM-DD, shift start date
  startedAt: ISO
  authorId: string
  closedAt?: ISO
  notes: Note[]
  incidents: Incident[]
  sections: Partial<Record<SectionKey, Section>>
  gaps: Gap[]
  questions: AiQuestion[]
  suggestionsDismissed: boolean
}
```

**Derived, never stored:** rule gaps (D7), the gap counts, incident display numbers, the read-only state.

**Authorship in editors:** a small Tiptap extension adds the `by`/`at`/`sourceNoteIds` attrs to top-level blocks. An `appendTransaction` plugin sets `by: 'manager', at: now` on any block the user changes. New blocks typed by the user are created as `manager`.

---

## 6. AI pipeline

### 6.1 Flow per note
1. The store appends the note as `pending`, and the feed shows it instantly.
2. `POST /api/process-note` is sent with `{ note, context }`. The **context** is a compact snapshot:
   - incidents (id, display number, field values, which fields are manager-owned)
   - each section's plain text plus whether it has manager blocks
   - open gaps and questions
   - the shift date and start time
   - the current local time
3. The server calls Gemini with **structured output** (a Zod schema) and gets back `Operation[]`.
4. The client runs `applyOperations(shift, ops, noteId, now)`, a **pure function**. The note becomes `processed` with its `routedTo` set.
5. **On failure** (5xx, 429, a timeout of about 20 s, or a schema error), the server tries the **scripted fallback** (§6.4). If nothing matches, the note becomes `failed` with a retry option. The note is never lost.

### 6.2 Operations

```ts
type Operation =
  | { op: 'addIncident'; type: string; time?: EventTime; location?: string; description: string }
  | { op: 'updateIncident'; incidentId: string; type?: string; time?: EventTime; location?: string; description?: string }
  | { op: 'appendToSection'; key: SectionKey; paragraphs: string[] }   // plain text; bullets via "- " prefix
  | { op: 'setSummary'; paragraphs: string[] }
  | { op: 'addGap'; target: GapTarget; question: string; weight: 'required' | 'optional'; suggestion?: { value: string; reason: string } }
  | { op: 'resolveGap'; gapId: string }
  | { op: 'askQuestion'; question: string; options: string[] }
```

### 6.3 Merge rules (`applyOperations`), unit-tested
- **Manual edits win (D8).** `updateIncident` skips any field whose `prov.by === 'manager'`. `setSummary` replaces only the summary's `ai` blocks, and is dropped entirely if the summary has any `manager` block.
- `appendToSection` **only adds blocks** (with `by: 'ai'`) at the end of the section, creating the section if needed. It never touches existing blocks.
- Attachments of the source note go to the first incident it created or updated, otherwise to the first section it fed.
- `addGap` is skipped if an open gap with the same target and question already exists. AI gaps on a field resolve automatically once that field has a value.
- Unknown ids are ignored. All operations are validated with Zod before they're applied.
- `routedTo` is built from the operations actually applied.

**Rule gaps, `requiredGaps(shift)` (D7):** for each incident, a missing type, place or description, or a missing or `approx` time, gives a `required` gap with a fixed question:
- "Jaki typ zdarzenia?" (what type of event?)
- "Gdzie?" (where?)
- "Opis zdarzenia?" (description of the event?)
- "Dokładna godzina?" (exact time?)

### 6.4 Prompt and fallback
- **System prompt** (English instructions, Polish output). It covers:
  - the section keys with descriptions
  - the predefined incident types and venue areas (prefer them, free text allowed)
  - the incident minimums
  - weighting guidance:
    - required: injury → "was help given?"; violence or theft → "were police called?"; medical help → "who gave first aid?"
    - optional: a more precise location, witnesses, attaching evidence
  - ask questions only for notes it can't classify
  - never invent facts
  - mark approximate times `approx: true`
  - set the summary in 2–4 sentences
- **Scripted fallback:** canned operations for the demo phrases, plus a keyword heuristic (bójka, bił, kradzież, ukradł, zasłabł, karetka, policja, …) that creates an incident from the note text. If nothing matches, the note becomes `failed` with retry.
- **Model:** `gemini-3.8-flash` was verified with structured output on our key (about 10 s). During implementation we'll measure the `flash-lite` variants and pick the fastest that handles Polish well. The model id lives in one constant.
- **No server-side rate limiting.** The free-tier key has no billing. The fallback covers an exhausted quota.

---

## 7. Architecture and stack

- **Next.js (App Router) + TypeScript** on **Vercel**. Check the bundled Next docs before using any API.
- **Tailwind CSS + shadcn/ui** (brief constraint). Neutral theme, dark by default. Components used: Button, Popover, Calendar, Command (combobox), Select, DropdownMenu, Dialog, Tabs, Sonner (toast), Avatar, Textarea, Badge.
- **Tiptap** (`@tiptap/react` + starter kit, limited to paragraph, bold, italic and bullet list) for the section editors. Check its React 19 / Next compatibility at scaffold time.
- **Zustand + `persist`** (localStorage) for the `Shift` store. Components never touch storage directly.
- **Vercel AI SDK + Google provider + Zod** for structured output. The key is server-only, in `GOOGLE_GENERATIVE_AI_API_KEY`.
- **Vitest** (domain logic) and **Playwright** (one end-to-end happy path).

```
app/
  page.tsx                      # the one screen
  api/process-note/route.ts     # AI call + fallback
lib/
  report/types.ts  people.ts  catalog.ts (incident types, areas, section labels)
  report/operations.ts          # Operation schema + applyOperations
  report/gaps.ts                # requiredGaps, counts
  report/rich.ts                # RichDoc helpers (append blocks, plain text, authorship)
  report/seed.ts                # demo shift
  ai/prompt.ts  ai/fallback.ts
store/shift.ts                  # Zustand store, actions, selectors
components/
  shift/     Header, CloseDialog, ClosedBanner
  notes/     Feed, NoteItem, AiQuestion, Composer
  report/    ReportPanel, ReportHeader (date, author), IncidentBlock, TypeCombobox,
             TimePicker, PlacePicker, IncidentMenu, SectionEditor, GapChip, Suggestions
tests/unit  tests/e2e
```

**Boundaries:**
- `lib/report` is pure: no React, storage or network.
- The store is the only place state changes.
- The API route is the only code that knows about Gemini.
- Tiptap is confined to `SectionEditor` and `report/rich.ts`.

---

## 8. Testing
- **Unit (TDD), on domain logic:**
  - `applyOperations`: every operation, manual-edit protection, append-only sections, summary replacement rules, deduplication, invalid ids, attachment routing.
  - `requiredGaps`.
  - `rich.ts`: appending, authorship attributes, plain-text extraction.
  - `fallback`.
  - The operation schema, checked against sample model output.
- **E2E (one Playwright spec, AI route mocked):** load the demo → add a note → it gets processed → answer a required gap inline → edit a section → duplicate and remove an incident (then undo) → close with a gap → the locked view shows "brak danych".
- **Manual:** before submission, click through the deployed link with the **real** AI using several messy Polish notes.

---

## 9. Process and collaboration
- **Skills:**
  - brainstorming (this doc) → `writing-plans` → **`subagent-driven-development`**
  - `verification-before-completion` before calling anything done
  - `/code-review` before each merge
  - `/init` for CLAUDE.md after scaffolding
- **Design feedback:** comments on the canvas sent to Claude. The spec stays the source of truth, and canvas changes that affect behaviour are copied back here.
- **Git:**
  - Repo: `mr-kangaroo/lawka` (public).
  - The spec lives on `main`.
  - After that, **one short branch and one PR per plan task**, with small commits. `main` stays deployable.
- **Deploy:**
  - Connect the Vercel GitHub integration once. Every PR gets a preview URL, and `main` is the submission link.
  - Add `GOOGLE_GENERATIVE_AI_API_KEY` in the Vercel environment variables.
- **README:** what it is, the live link, how to run it, the decisions (short version of §2) and "Co dalej" (what's next):
  - an owner inbox and history
  - PDF/insurer export
  - rating fields
  - voice dictation
  - real uploads

### Time budget (8 h)

| Block | Time |
|---|---|
| Design + spec | ~1:00 (spent) |
| Implementation plan | ~0:30 |
| Scaffold + deploy pipeline (empty app live) | ~0:30 |
| Domain logic + tests (types, operations, gaps, rich, seed, fallback) | ~1:15 |
| AI route + prompt + model choice | ~0:45 |
| UI: feed, composer, report header, incidents (pickers, menu), section editors, gaps | ~2:30 |
| Close flow, locked view, phone tabs | ~0:45 |
| E2E, polish, README | ~0:45 |

**Cut line, if behind, in this order:**
1. The suggestions box.
2. Duplicate (keep remove with undo).
3. Pre-filled AI suggestions in gap answers (keep plain inline answers).
4. Phone tabs (keep a stacked layout).
5. The time picker dropdown (keep a plain HH:MM input).

---

## 10. Open questions
None that block us. Decisions taken where the brief is silent are in §2.
