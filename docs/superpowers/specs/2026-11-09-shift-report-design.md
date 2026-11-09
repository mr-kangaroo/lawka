# Ławka — Shift Report (Raport ze zmiany) — Design Spec

- **Date:** 2026-11-09
- **Status:** Draft, awaiting review
- **Brief:** Notion: "🪡 Zadanie na ławce" (wearetonik)
- **Visual reference:** [Design canvas](https://claude.ai/artifact/3jojprCgVBaPsRuMua5Ykm), option 1 is the chosen direction
- **Timebox:** 8 hours total, including this spec

---

## 1. Goal

A bar or club manager produces a **complete, legally defensible shift report in under 10 minutes** without it feeling like paperwork. After opening the tool they should think: *"This is faster than what I did before, and I didn't forget anything."*

The deliverables are a **clickable, deployed prototype** (link) and a **public GitHub repo**. The goal is creative direction, not pixel perfection.

### Users

- **Primary:** experienced shift managers who are tired. They capture quick notes on a **phone** during the shift and close the shift on a **laptop at about 3 a.m.**
- **Secondary:** owners and operators who read the reports. We don't design for them here.

### Success criteria for the prototype

1. A reviewer can open the link and understand the flow without explanation.
2. Free text goes in and a structured report comes out. The AI's help is visible and useful, never in the way.
3. Incidents are recorded close to the moment they happen, with evidence chips attached.
4. Missing required details are obvious. Missing nice-to-have details are visible but quiet.
5. A shift can be closed with gaps, because we don't demand perfection, and the gaps are recorded in the report.

---

## 2. Decisions log

| # | Decision | Why |
|---|----------|-----|
| D1 | **One live report per shift**, open all night. Mid-shift quick notes plus the 3 a.m. close use one screen. | Answers "incidents documented close to the moment" without adding a second flow. |
| D2 | **Layout: a notes feed (left) next to a live report (right).** On a phone the two become tabs. | Resolves the brief's tension between guided and free text without a mode choice. Latency doesn't block the manager. |
| D3 | **The AI asks questions inside the feed**, under the unclear note, with quick-reply buttons and a short text field. It only asks when it can't classify a note. | A conversation without turning the app into a chat. |
| D4 | **Gaps have weight: `required` (amber, counted) or `optional` (grey dashed, quiet).** | Not every gap matters equally. "Which toilet?" shouldn't nag. |
| D5 | **The legal minimum for incidents (time, place, type, description) is enforced by code**, not the AI. The AI adds context-specific questions with a weight. | Legal requirements must be reliable and testable. |
| D6 | **The report is editable in place. Manual edits always win.** The AI never overwrites a field the manager edited. | Fixing text directly is faster than asking the AI. Trust. |
| D7 | **The AI returns a list of changes (operations), not a whole report.** | It can't silently drop content or edits. Small requests suit the free tier. Easy to unit-test. |
| D8 | **Notes are never changed or deleted.** Every report field records who wrote it last (AI or manager) and when. | Audit trail for legal and insurance use. |
| D9 | **AI: Google Gemini free tier through the Vercel AI SDK**, with a scripted fallback. | Free, with no billing risk on a public link. Swapping provider is one line. The free tier returns 503s, so the fallback is required. |
| D10 | **UI language: Polish.** Code, comments, commits and the spec in English. | The users and the brief are Polish. Shows the AI handling Polish input. |
| D11 | **No backend. State lives in localStorage.** | 8-hour timebox. Refresh-safe at 3 a.m. |
| D12 | **Voice dictation is a stretch goal** (Web Speech API, `pl-PL`). The button is hidden when the browser doesn't support it. | Cheap and high value, but cut first if time runs short. |
| D13 | **The neutral shadcn theme, dark-first.** No branding. | Brief constraint. Design effort goes into the flow. |

---

## 3. Scope

### In scope
- One screen with three states: the shift running, closing with a review, and a closed (locked) report.
- Notes: text input, fake attachments (file chips and placeholder thumbnails), timestamps.
- AI processing of each note into report operations, plus AI follow-up questions in the feed.
- A report view: incidents first, then only the sections that have content. Everything editable in place.
- Gap indicators (required/optional), a required count in the header, answering a gap in place.
- The closing flow: a review of the missing required details, "close anyway", then the locked report with the closing time.
- A seeded demo shift (notes from 21:15 onward) and a "start a new shift" reset.
- Responsive layout: laptop (two columns), phone (tabs).
- Stretch: voice dictation.

### Out of scope (from the brief)
- Other flows: owner dashboard, history of shifts, multiple venues, authentication.
- Real file handling (upload, storage, preview).
- Export, PDF or sending the report anywhere. "Closed" means locked and shown.

---

## 4. UX

### 4.1 Layout (laptop)

```
┌ Header: Raport ze zmiany · date · start 20:00 · [Zmiana trwa]   ⚠ 3 wymagane · 2 warto dodać  [Zamknij zmianę] ┐
├──────────────── Notatki (feed) ───────────────┬──────────────────── Raport ────────────────────┤
│ 21:15 note text                               │ legend: ● wymagane  ◌ warto dodać               │
│       ✦ → Publiczność · Imprezy prywatne      │ ✦ "Nic o ochronie, barze…" [+ Ochrona] [+ Bar]  │
│ 22:41 note text  [IMG_2231.jpg]               │ ┌ Incydenty ─────────────────────────────────┐ │
│       ✦ → Incydent #1                         │ │ #1 Bójka · 22:40 · Bar główny          ✎  │ │
│ 01:48 unclear note                            │ │   description · [chip] · gap chips         │ │
│   ┌ ✦ AI question + [Tak] [Nie] + reply ┐     │ └────────────────────────────────────────────┘ │
│ 02:52 note  ⟳ porządkuję…                     │ Podsumowanie (AI draft, editable)              │
│ ┌ composer: textarea · 🎤 · 📎 · [Dodaj ↵] ┐  │ Section cards (only those with content)        │
└───────────────────────────────────────────────┴────────────────────────────────────────────────┘
```

On a phone, **Notatki | Raport** become tabs. The Raport tab label shows the required-gap count. The composer is pinned to the bottom with large (≥44 px) attach and mic buttons.

### 4.2 The notes feed
- Each note shows the **time it was recorded** (HH:MM), its text and its attachment chips.
- Under each processed note is a **routing tag**: ✦ plus the report targets it fed (for example "→ Incydent #1").
- Note states: `pending` ("porządkuję…" with a spinner), `processed` (routing tag), `failed` ("Nie udało się uporządkować · [Ponów]").
- **An AI question** appears under its note as a bordered block: the question, 0–3 quick-reply buttons and a free-text reply field. Answering creates a new note linked to the question (`replyTo`), which is processed like any other note. The question then collapses to show the answer.
- Composer: a multi-line textarea. **Enter** sends, **Shift+Enter** adds a new line. Attach adds fake file chips (picking a file is simulated: the chip shows a name and type, with a placeholder thumbnail for images). Mic is the stretch goal.

### 4.3 The report panel
- **Order:** an AI suggestions box (which key sections haven't been mentioned, with "+ Section" buttons that put the cursor in the composer pre-filled with "Ochrona: "), then **Incydenty**, then **Podsumowanie**, then the other sections that have content, in the brief's order.
- **Incident card:** `#N Type · time · place`, then the description, attachment chips, gap chips and "zapisano HH:MM" (recorded at).
  - An approximate time (`koło 1`, "around 1") shows in amber, and its "exact time" gap is required.
  - The ✎ button switches the card to edit mode: time, place, type (free text with suggestions) and description.
- **Section card:** a title plus its entries, one short paragraph each. Click an entry to edit it (a textarea with Zapisz/Anuluj; Esc cancels, Cmd+Enter saves). An edited entry shows "✎ edytowano HH:MM". New AI entries are appended below and never rewrite the manager's text.
- **Gap chips:**
  - `required`: amber fill, bolder text.
  - `optional`: dashed grey outline, muted text.
  - Clicking a chip opens an **inline answer field** in the card. If the AI can suggest a value, it's pre-filled with a short reason (for example "AI: w notatce „koło 1", zapisana 01:30", meaning the note said "around 1" and was recorded at 01:30). Saving writes the field as a manager edit.
  - Optional chips have a dismiss button (×). Required chips can't be dismissed, only answered or left open.
- **Header count:** "⚠ N wymagane" in amber, then "· M warto dodać" in muted grey.

### 4.4 Closing the shift
1. "Zamknij zmianę" opens a **review dialog**:
   - If there are no required gaps: "Raport kompletny. Zamknąć zmianę?" ("Report complete. Close the shift?") → [Zamknij].
   - Otherwise it lists the required gaps (each one clickable to jump to it) and offers [Uzupełnij] (fill in, the default) and [Zamknij mimo to] (close anyway).
2. After closing, the report becomes **read-only**:
   - It shows "Zamknięto 03:07".
   - Unresolved required gaps are shown as "brak danych" (no data) in the report.
   - The composer is hidden.
   - A "Nowa zmiana" (new shift) button resets the app to an empty shift. The demo menu also offers to reload the demo shift.

### 4.5 Demo seed
On first load, or after "Załaduj demo" (load demo), the app starts with the shift begun at 20:00 and the notes at 21:15, 22:41 (with a photo chip), 00:30 and 01:30 **already processed** from stored operations. No AI call is needed, so the first impression is instant and reliable. The reviewer then adds their own notes, which go to the live AI.

---

## 5. Data model

TypeScript sketch. The final names go in `lib/report/types.ts`.

```ts
type ISO = string // ISO-8601 timestamp

type Author = 'ai' | 'manager'
type Provenance = { by: Author; at: ISO; sourceNoteIds: string[] }
type Field<T> = { value: T; prov: Provenance }

type Attachment = { id: string; name: string; kind: 'image' | 'video' | 'document' } // fake

type Note = {
  id: string
  createdAt: ISO
  text: string
  attachments: Attachment[]
  replyTo?: string                 // AiQuestion.id when the note answers a question
  status: 'pending' | 'processed' | 'failed'
  routedTo: string[]               // human-readable targets for the routing tag
}

type EventTime = { hhmm: string; approx: boolean } // date derived from the shift (after midnight = next day)

type Incident = {
  id: string
  number: number                   // #1, #2…, stable
  type: Field<string> | null
  time: Field<EventTime> | null
  location: Field<string> | null
  description: Field<string> | null
  attachments: Attachment[]
  sourceNoteIds: string[]
}

type SectionKey =
  | 'summary' | 'audience' | 'security' | 'artists' | 'doorStaff' | 'production'
  | 'bar' | 'kitchen' | 'suppliers' | 'privateEvents' | 'maintenance' | 'stock'

// A section is a list of entries, each with its own authorship. The AI only ever ADDS entries;
// the manager edits entries in place. Rendered as one flowing paragraph per entry.
type Section = { key: SectionKey; entries: Field<string>[]; attachments: Attachment[] }

type GapTarget =
  | { kind: 'incident'; incidentId: string; field?: 'time' | 'location' | 'type' | 'description' }
  | { kind: 'section'; key: SectionKey }

type Gap = {
  id: string
  target: GapTarget
  question: string                 // Polish, shown on the chip
  weight: 'required' | 'optional'
  origin: 'rule' | 'ai'            // rule = computed by code (D5)
  suggestion?: { value: string; reason: string }
  status: 'open' | 'answered' | 'dismissed'
  answer?: Field<string>           // for gaps without a target field, e.g. "Czy udzielono pomocy rannemu?" → "Tak, ratownik ochrony"
}

type AiQuestion = {
  id: string
  noteId: string
  question: string
  options: string[]                // 0–3 quick replies
  status: 'open' | 'answered'
}

type Shift = {
  id: string
  startedAt: ISO
  closedAt?: ISO
  notes: Note[]
  incidents: Incident[]
  sections: Partial<Record<SectionKey, Section>>
  gaps: Gap[]                      // AI-origin gaps only; rule gaps are derived
  questions: AiQuestion[]
}
```

**Derived, never stored:** rule-based gaps (D5), required/optional counts, "edytowano HH:MM" (from `prov`), and the closed or read-only state.

---

## 6. AI pipeline

### 6.1 Flow per note
1. **Client:** the store appends the note with `status: 'pending'` and the UI shows it instantly.
2. **Client → `POST /api/process-note`** with `{ note, shiftContext }`. `shiftContext` is a compact snapshot of the current report: the incidents and sections with their values and authorship, the open questions, `startedAt`, and the current local time.
3. **Server:** builds the prompt and calls Gemini with **structured output** (a Zod schema) → `Operation[]`.
4. **Client:** `applyOperations(shift, ops, noteId)`, a **pure function**, merges the result. The note becomes `processed` with its `routedTo` set.
5. **On failure** (5xx, 429, timeout of about 20 s, or invalid output): the server tries the **scripted fallback** (§6.4). If that can't handle the note either, the note becomes `failed` with a retry option. The note is never lost.

### 6.2 Operations (the AI's output schema)

```ts
type Operation =
  | { op: 'addIncident'; type: string; time?: EventTime; location?: string; description: string }
  | { op: 'updateIncident'; incidentNumber: number; type?: string; time?: EventTime; location?: string; description?: string; appendDescription?: string }
  | { op: 'appendSection'; key: SectionKey; text: string }
  | { op: 'setSummary'; text: string }
  | { op: 'addGap'; target: GapTarget; question: string; weight: 'required' | 'optional'; suggestion?: { value: string; reason: string } }
  | { op: 'resolveGap'; gapId: string }
  | { op: 'askQuestion'; question: string; options: string[] }
```

### 6.3 Merge rules (`applyOperations`) — unit-tested
- **Manual edits win (D6).** An operation that would change a field whose `prov.by === 'manager'` is **dropped**. This covers incident fields and the summary (`setSummary` is ignored once the manager has edited it). `appendSection` always adds a **new entry** and never touches existing entries, so manager-edited entries are safe by construction.
- **Gap answers:** answering a gap that targets a field writes that field as a manager edit. Answering a gap without a field stores `answer` on the gap, rendered under the incident or section as "question — answer". An AI gap whose target field later gets a value (from either author) is resolved automatically.
- Attachments on the source note are copied to the incident or section the note fed. If a note feeds several targets, the first incident wins; otherwise the first section.
- `addGap` is skipped when an open gap with the same target and question already exists, so the AI doesn't keep repeating itself.
- Unknown incident numbers and gap ids are ignored. Operations are validated by Zod before they're applied.
- `routedTo` is built from the operations that were actually applied.

**Rule gaps (D5), computed by `requiredGaps(shift)`:** for each incident, a missing type, location or description, or a missing or approximate time, produces a `required` gap with a fixed Polish question:
- "Dokładna godzina?" (exact time?)
- "Gdzie?" (where?)
- "Jaki typ zdarzenia?" (what type of event?)
- "Opis zdarzenia?" (description of the event?)

### 6.4 Prompt and fallback
- **System prompt (Polish output, English instructions):** the venue context, a description of each section key, the incident minimums, and weighting guidance:
  - **Required:** an injury means "was help given?"; violence or theft means "were police called?"; medical help means "who gave first aid?".
  - **Optional:** precise sub-location, witnesses, a suggestion to attach evidence.
  - Ask a question (`askQuestion`) only when the note can't be classified. Never invent facts. Approximate times get `approx: true`.
- **Scripted fallback:** canned operations for the demo phrases, plus a keyword heuristic for the most common incident words (bójka, kradzież, zasłabł, …), so the live demo works during an outage. If no rule matches, the note stays `failed` with retry.
- **Model:** `gemini-3.8-flash` was verified working with structured output on our key (about 10 s). During implementation we'll measure `-flash-lite` variants and pick the fastest that still handles Polish well. The model id lives in one constant.
- **No server-side rate limiting.** The free-tier key has no billing, so abuse can't cost money. The fallback covers exhausted quota. (YAGNI.)

---

## 7. Architecture and tech stack

- **Next.js (App Router) + TypeScript**, deployed on **Vercel**. The same family as our sibling repos. We check `node_modules/next/dist/docs` before using Next APIs, because versions move fast.
- **Tailwind CSS + shadcn/ui** (brief constraint). Neutral theme, dark by default.
- **Zustand + `persist`** (localStorage) for the single `Shift` store. Components never touch storage directly.
- **Vercel AI SDK + Google provider + Zod** for structured output. The API key is server-only (`GOOGLE_GENERATIVE_AI_API_KEY`), in `.env.local` and Vercel environment variables.
- **Vitest** for domain logic and **Playwright** for one end-to-end happy path.

```
app/
  page.tsx                    # the one screen
  api/process-note/route.ts   # AI call + fallback
lib/
  report/types.ts             # §5
  report/operations.ts        # Operation schema (Zod) + applyOperations
  report/gaps.ts              # requiredGaps, counts
  report/seed.ts              # demo shift
  ai/prompt.ts                # system prompt builder
  ai/fallback.ts              # scripted/heuristic ops
store/shift.ts                # Zustand store, actions, selectors
components/
  notes/                      # Feed, NoteItem, AiQuestion, Composer
  report/                     # ReportPanel, IncidentCard, SectionCard, GapChip, Suggestions
  shift/                      # Header, CloseDialog, ClosedBanner
tests/unit, tests/e2e
```

**Boundaries:**
- `lib/report` is pure and holds no React, storage or network code.
- The store is the only thing that changes state.
- The API route is the only code that knows about Gemini.

---

## 8. Testing
- **Unit (TDD), on domain logic only:**
  - `applyOperations`: every operation type, manual-edit protection, deduplication, ignoring invalid references, attachment routing.
  - `requiredGaps`: each missing or approximate field.
  - `fallback`: demo phrases and the keyword heuristic.
  - The operation Zod schema, checked against sample model output.
- **E2E (Playwright, one spec):** load the demo → add a note → it appears and gets processed (the API is mocked in e2e to return fixed operations) → answer a gap inline → edit a section → close with a gap → the locked view shows "brak danych".
- **Manual:** before submission, click through the deployed link with the **real** AI using several messy Polish notes.

---

## 9. Process and collaboration

- **Skills:** brainstorming (this doc) → `writing-plans` → **`subagent-driven-development`** (chosen) → `verification-before-completion` → `/code-review` before each merge. `claude-api` doesn't apply because we use Gemini. `/init` creates CLAUDE.md after scaffolding.
- **Git:** repo `mr-kangaroo/lawka` (public). This spec is the first commit on `main`. After that, **one short branch and one PR per plan task**, with small commits. `main` stays deployable.
- **Deploy:** the Vercel GitHub integration, which the user connects once. Every PR gets a preview URL, and `main` is the submission link. Add `GOOGLE_GENERATIVE_AI_API_KEY` in Vercel's environment variables.

### Time budget (8 h)

| Block | Time |
|-------|------|
| Design + spec (this) | ~0:45 |
| Implementation plan | ~0:30 |
| Scaffold + deploy pipeline (empty app live on Vercel) | ~0:30 |
| Domain logic + tests (types, operations, gaps, seed, fallback) | ~1:15 |
| AI route + prompt + model selection | ~0:45 |
| UI: feed, composer, report, gaps, inline edit | ~2:00 |
| Close flow + locked view + responsive/mobile | ~0:45 |
| E2E + polish + README | ~0:45 |
| Stretch: voice | ~0:30 if time allows |

**Cut line, if behind:** voice → AI suggestions box → inline gap answering with a suggested value (keep plain inline editing) → mobile tabs (keep the stacked layout).

---

## 10. Open questions
None that block us. Decisions taken where the brief is silent are listed in §2.
