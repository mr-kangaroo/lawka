# Ławka — Shift Report (Raport ze zmiany) — Design Spec

- **Date:** 2026-11-09
- **Status:** v3 (modes layout), approved for planning
- **Brief:** Notion "🪡 Zadanie na ławce" (wearetonik)
- **Visual reference:** [design canvas](https://claude.ai/artifact/3jojprCgVBaPsRuMua5Ykm), the **"v2 —" row**: frames "v2 · Dziennik zmiany (desktop)", "v2 · Raport (desktop)" and "v2 · Dziennik (telefon)". The report-document details (incidents, sections, popovers) are in frame "1 · Notes feed + report as a document" and "1 · Open states (popovers)". Options 2 and 3 were rejected and are kept only for comparison.
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
| D2 | **Two modes in one column: tabs "Dziennik zmiany" (shift journal) and "Raport" (report), with one input pinned at the bottom.** The journal is for recording what happens during the shift; the report is the finished document for closing. The same layout serves phone and laptop. | Two jobs, two contexts. The report is always ready when you switch, which shows the AI's work best. One layout means less code. |
| D3 | **Structured underneath, a document on the surface.** The report looks and edits like one document, but the data stays structured. There are fixed fields (date, author), **fixed section headings** that can't be renamed, deleted or invented, **incidents as structured records**, and rich text only *inside* sections. Stored as JSON keyed by section, never as one markdown blob. | Evidence for compliance needs consistency, validation and queryable data. The manager needs it to not feel like a form. |
| D4 | **Each section has its own small rich-text editor** (Tiptap: bold, italic, bullet list), styled so the sections read as one continuous document. There is **no formatting toolbar**: formatting is by keyboard shortcuts and markdown-style typing (see §4.5). | Simpler and safer than one editor for the whole report: the structure can't break, the AI writes into a known place, and authorship is tracked per paragraph. |
| D5 | **The journal never asks questions.** The manager is busy during the shift and only throws thoughts in. When the AI isn't sure a note is an incident, it adds a **possible incident** to the report (amber, "#3?", "Czy to był incydent?" with [Tak, to incydent] / [Nie, usuń]). Clarifying happens in the Raport tab. *(Changed after feedback: the question card above the input is gone.)* | The journal is for dumping thoughts at 2 a.m.; the report is where you review. |
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
| D16 | **Voice dictation as a stretch goal:** a 🎤 button in the input using the browser's speech recognition (`pl-PL`). The dictated text goes into the input to check before adding. Hidden in unsupported browsers. | Cheap and valuable at 3 a.m. Built last and first to cut. |
| D17 | **Five fixed sections, always shown:** Podsumowanie, Incydenty, Publiczność i bezpieczeństwo, Ochrona, Usterki i sprzęt. **The other eight appear only when relevant.** An empty fixed section is confirmed explicitly ("Bez uwag", nothing to report). **"Brak incydentów" (no incidents) is a required confirmation.** | In evidence, "nothing happened" is a fact. An explicitly confirmed empty section is worth more than a missing one. |
| D18 | **The report is built continuously in the background**, one note at a time. Switching to the Raport tab never triggers generation. | One big call at 3 a.m. would be slow (10–30 s) and the riskiest moment of the night. |
| D19 | **The single input always adds to the journal**, in both tabs. Corrections typed in the Raport tab ("incydent 2 był o 01:05") are journal notes the AI turns into update operations. Direct editing of the report stays the main way to fix text. | No separate chat or command system. One mental model. |

---

## 3. Scope

### In scope
- One screen, two tabs, three states (shift running, review before sending, sent/read-only).
- **Header:** "← Wróć" (back; a placeholder with no action), "● Zmiana trwa · od 20:00" (shift in progress since 20:00), the tabs **[Dziennik zmiany | Raport ③]** (the badge is the required-gap count), and a primary button on the right: "Zobacz raport" (see report) in Dziennik, "Wyślij raport" (send report) in Raport.
- **Dziennik zmiany:** a centred timeline of notes with timestamps, attachment chips, routing tags, and pending/failed/waiting states.
- **One input** at the bottom of both tabs: text, fake attachments (chips and placeholder thumbnails), 🎤 (stretch), "Dodaj ↵".
- **Raport:** a centred document:
  - fixed title, Notion-style properties (date, author)
  - incidents as structured blocks: inline underlined type/time/place opening popovers, a rich-text description, attachments, gap chips, a hover menu with duplicate/remove, "+ Dodaj incydent"
  - five fixed sections with "Bez uwag", conditional sections, section hints
- AI processing of notes into operations, plus follow-up gaps in the report.
- Gap indicators, the tab badge, answering gaps in place.
- Send flow: review dialog → "send anyway" → read-only report with the sending time.
- A seeded demo shift and a reset.
- Responsive: the same layout from phone to laptop.

### Out of scope
- Other flows (from the brief): the owner/reader view, a list or history of reports, multiple venues, login, the app's home page (the back button is a placeholder).
- Real file handling (from the brief).
- Real sending, export, PDF, notifications. "Wyślij raport" only locks the report.
- Rating fields for sections like "ocena bramkarzy" or "ocena baru" (door staff and bar ratings). These go in the README under "Co dalej" (what's next).

---

## 4. UX

Copy below is Polish UI text. The English in parentheses is only for the reader of this spec.

### 4.1 Layout

```
┌ ← Wróć  ● Zmiana trwa · od 20:00     [ Dziennik zmiany | Raport ③ ]           [Zobacz raport] ┐
│                                                                                                │
│                      centred column (journal ~720px / report ~760px)                           │
│   Dziennik: 21:15 note … → Publiczność i bezpieczeństwo · Imprezy prywatne                     │
│             22:41 note … [IMG_2231.jpg]   Incydent #1                                          │
│             01:48 note … Możliwy incydent #3                                                   │
│             02:52 note … ⟳ porządkuję…                                                         │
│   Raport:   title · properties · Podsumowanie · Incydenty · fixed sections · hints             │
│                                                                                                │
│   ┌ Co się dzieje? …                                              🎤  📎  [Dodaj ↵]     ┐     │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Default tab:** Dziennik while the shift is running. The Raport tab is available at any time, because the brief says not to force a choice.
- **"Zobacz raport"** (Dziennik tab) switches to the Raport tab. **"Wyślij raport"** (Raport tab) opens the review (§4.7).
- **Tab badge:** the number of required gaps, in amber (an 18 px circle for one digit, a pill from two). An empty shift (no notes yet) shows no badge: "Potwierdź: brak incydentów" counts only after the first note, though the send dialog still asks for it. There's no other count in the header.
- **Phone:** the same structure. The tabs span the full width under a compact header (back icon, a shorter status "● od 20:00" so the primary button fits at 360 px). Section headings are 18 px. Input buttons are ≥44 px. After a note is filed, a short confirmation appears above the input ("Zapisano jako Incydent #1 · 22:40", saved as incident #1).

### 4.2 Dziennik zmiany (journal) and the input
- **No date/author line** above the entries; those live in the report's properties.
- **Empty journal** (new shift): a centred empty state: "Zapisuj, co dzieje się na zmianie" (log what happens on the shift) and "Pisz krótko, jak na czacie: godzina, co się stało i gdzie. AI na bieżąco ułoży z tego raport, a gdy czegoś zabraknie, dopyta." (write briefly, as in a chat: the time, what happened and where; the AI builds the report as you go and asks when something is missing).
- **Each entry** shows its recorded time (HH:MM) in a left column, the text, attachment chips on their own line, and the routing tag under them.
- **Routing tag** under processed entries: a muted "Incydent #1", "Możliwy incydent #3" or "Publiczność i bezpieczeństwo · Imprezy prywatne" (no arrow; the summary is never listed). This is the only place where AI work is labelled. It shows where a note went, not who wrote what.
- **Entry states:**
  - `pending`: "porządkuję…" (organising) with a spinner.
  - `processed`: the routing tag.
  - `failed`: "Nie udało się uporządkować · [Ponów]" (couldn't organise · retry).
- **Only notes written in the journal are shown in it.** Notes written in the Raport tab (corrections and gap-chip answers) update the report only; a toast tracks them: "Uwzględniam w raporcie…" → "Raport zaktualizowany", or "Nie udało się uwzględnić notatki" with [Ponów].
- **Editing a note:** clicking its text edits it in place, and "Anuluj / Zapisz" (cancel / save) replace the status line (Enter saves, Esc cancels). Not while the note is being organised or after sending. Saving files the note again: the AI text written from that note alone is replaced (manager-written text never is), the incidents it was filed to are updated rather than duplicated, and the report changes only when the AI succeeds; otherwise the note shows "Nie udało się uporządkować · Ponów".
- **Input:**
  - Placeholder in Dziennik: "Co się dzieje? Pisz jak na czacie — np. „23:10 awantura na bramce"" (what's happening? write as in a chat, e.g. "23:10 row at the door").
  - Placeholder in Raport: "Dopisz coś albo popraw — np. „incydent 2 był o 01:05"" (add something or correct it, e.g. "incident 2 was at 01:05").
  - Enter sends, Shift+Enter adds a new line. 📎 adds a fake file chip. 🎤 dictates (stretch, D16).
  - Notes sent from the Raport tab show the progress toast above instead of switching tabs. Toasts appear in the bottom-right corner, above the input.

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
- **Header row:** a sentence-like line, **`#1 Bójka · 22:40 · Bar główny`**. Each value is **plain inline text with a subtle dashed underline**, with no boxes, borders or chevrons, so the block reads like part of the document rather than a form. Clicking a value opens its picker in a popover. Empty values show a muted placeholder ("typ", "godzina", "miejsce", for type, time and place) with the same underline.
  - **Type:** opens a popover with a **search field at the top**. Typing filters a predefined list with the matches in bold. The last option is always "+ Użyj „<query>" jako własnego typu" (use the query as a custom type). Predefined types:
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
  - **Time:** with no hour in the note ("chwilę temu", nothing) the time is empty and reads "00:00" at 60% opacity, in amber as a required gap; an estimate exists only when the note names an hour ("po 1" → ? 01:30). It opens a **time picker popover** (HH:MM in 5-minute steps, plus typing an exact time). An approximate time is shown in amber, with an amber underline, as **"? 01:00"**: a bold question mark before the time marks it as an estimate.
    - **Estimated time (`? 01:00`):** hovering or focusing shows a **tooltip** with the AI's explanation, quoting the manager's own words: *"W notatce: „koło 1". Sprecyzuj, jaka była dokładna godzina zdarzenia."* ("The note says 'around 1'. Specify the exact time of the event.") Clicking opens the time picker. There is **no separate inline panel or chip** for this.
    - The tooltip uses impersonal phrasing because a Polish second-person past tense is gendered ("Napisałeś/Napisałaś").
  - **Place:** opens a popover listing the venue's areas, plus "Inne…" (other) for free text:
    - Wejście / bramka (entrance / door)
    - Szatnia (cloakroom)
    - Bar główny (main bar)
    - Parkiet (dance floor)
    - Loża VIP (VIP booth)
    - Toaleta damska (women's toilet)
    - Toaleta męska (men's toilet)
    - Palarnia (smoking area)
    - Przed lokalem (outside the venue)
  - Right side: **"dodano o HH:MM"** (added at). **On hover or focus** this becomes a **⋯ button** opening a menu:
    - **Duplikuj (duplicate):** inserts a copy below. Its fields count as manager edits.
    - **Usuń (remove):** shown in red. Removes the incident and shows a toast, "Usunięto incydent · Cofnij" (incident removed · undo), for about 8 s. Source notes are never removed.
    - "dodano o HH:MM" stays visible as a muted footer of the menu.
- **Body:**
  - **The description is ordinary document text**: the same Tiptap editor, typography and shortcuts as the sections. It reads as one or more plain paragraphs, and everything in it is editable. There are no fixed sub-elements. Answers to questions are **woven into the description as normal sentences** (for example "…Jedna osoba z rozciętą wargą — opatrzona przez ochronę na miejscu, odmówiła karetki.", "one person with a split lip, treated by security on site, refused an ambulance"), not shown as separate "question — answer" rows.
  - Attachment chips.
  - Gap chips.
- **"+ Dodaj incydent"** (add incident) is a quiet text button **to the right of the "Incydenty" heading**. Most incidents arrive through notes and the AI, so manual adding is secondary. It adds an empty incident whose four required fields immediately show as field gaps.

### 4.5 Report: sections
- **Fixed sections, always shown, in this order:**
  1. **Podsumowanie** (summary): drafted by the AI.
  2. **Incydenty** (incidents): when there are none, it looks like the other empty sections: "Nie zgłoszono żadnych incydentów. Dodaj incydent" (the add button inline, with a dotted underline), and a dashed **[✓ Brak zdarzeń]** (no events) button on the right of the heading confirms it. With incidents, "+ Dodaj incydent" sits on the right of the heading instead. This is a **required** gap until clicked. Clicking writes "Brak incydentów w trakcie zmiany." (no incidents during the shift) as a manager-authored line. Adding an incident later removes that line.
  3. **Publiczność i bezpieczeństwo** (audience and safety): crowd size, queues, crowding, safety concerns.
  4. **Ochrona** (security)
  5. **Usterki i sprzęt** (faults and equipment)
- **An empty fixed section** (3–5) shows a muted prompt ("Co z ochroną? Napisz w notatce albo potwierdź.", what about security? write a note or confirm) and a dashed **[✓ Bez uwag]** button on the right of the section heading. Until it's filled or confirmed, it's an **optional** gap (not counted). Clicking writes "Bez uwag." as a manager-authored line.
- **Conditional sections** (in the brief's order, after the fixed ones): Ocena bramkarzy (door staff rating), Artyści i ekipa (artists and crew), Produkcja / przebieg / otwarcie drzwi (production, running order, door opening), Bar, Kuchnia (kitchen), Dostawcy zewnętrzni (external suppliers), Imprezy prywatne (private events), Stany magazynowe (stock).
  - They appear when the AI files content there, or when the manager adds one from the hints below.
  - Ocena bramkarzy stays separate from Ochrona, as in the brief.
- The text inside a section is a Tiptap editor (paragraphs, **bold**, *italic*, bullet lists). Click anywhere to type. **No toolbar.** Formatting uses keyboard shortcuts only: **⌘/Ctrl+B** for bold, **⌘/Ctrl+I** for italic, and typing **"- "** or **"* "** at the start of a line (or **⌘/Ctrl+Shift+8**) for a bullet list. These are Tiptap's defaults, so there's no custom code. There are **no heading controls**, because headings are structure.
- **Section hints at the end of the report:** a muted label "Dodaj do raportu" (add to the report) and, on the line below, dashed pill chips (at most one row; the rest behind "+ N więcej") for the **conditional sections not yet present**, in a fixed order of how often they typically appear. The order is static (no analytics):
  1. Bar
  2. Ocena bramkarzy
  3. Produkcja / przebieg
  4. Stany magazynowe
  5. Artyści i ekipa
  6. Kuchnia
  7. Dostawcy zewnętrzni
  8. Imprezy prywatne
  - The first five are shown, and the rest sit behind "+ N więcej" (N more).
  - Clicking a chip adds that section with the cursor in it, and the chip disappears.
  - These are hints, not gaps: they're never counted or required.

### 4.6 Gaps
- **Field gaps** (missing or estimated type, time, place or description, from the rule in §6.3) are shown **on the field itself**, not as chips: an amber placeholder ("godzina", "miejsce", …) or the amber `? 01:00`, each with an explanatory tooltip. They still count toward the required total (the Raport tab badge).
- **Question gaps** ("Czy wezwano policję?", were the police called?) are shown as **chips**:
  - `required`: amber fill, bolder text.
  - `optional`: dashed grey outline, muted text.
  - There is no legend: the two chip styles explain themselves.
- **Clicking a question chip opens a small popover** with a one-line answer field, pre-filled with the AI's suggestion when there is one. Saving does two things:
  - The answer becomes a **note in the feed**, linked to the gap, so the record stays complete.
  - The note is processed like any other: the AI rewrites it into a natural sentence and appends it to the incident description (or section) with `appendToIncident` / `appendToSection`.
  - The chip disappears straight away. If the AI fails, the fallback appends "<question> <answer>." as plain text, which the manager can polish.
- Optional chips can be dismissed (×). Required chips can only be answered, or left open and marked in the closed report.
- **Counts:** the required total is the amber badge on the Raport tab. Optional gaps aren't counted anywhere; they're visible in place.

### 4.7 Sending the report
1. **"Wyślij raport" opens a review dialog.**
   - With no required gaps: "Raport kompletny. Wysłać?" (report complete, send?), body "Wszystkie wymagane informacje są uzupełnione. Po wysłaniu raportu nie będzie można już edytować." (all required information is filled in; after sending, the report can't be edited) → [Wyślij].
   - Otherwise, the title "Do uzupełnienia przed wysłaniem", body "Tych informacji wciąż brakuje. Jeśli wyślesz teraz, w raporcie pojawią się jako „brak danych”, a raportu nie będzie można już edytować." (this information is still missing; if you send now, it will show as "no data" and the report can't be edited), the list of required gaps (each one jumps to its place), [Uzupełnij] (fill in, the default) and [Wyślij mimo to] (send anyway).
2. **The report becomes read-only.**
   - It shows "Wysłano 03:07" (sent at 03:07) and the status in the header becomes "Zmiana zamknięta" (shift closed).
   - Unresolved required gaps show as "brak danych" (no data).
   - Editors, chips and the input are disabled or hidden.
   - "Nowa zmiana" (new shift) resets the app to an empty shift.

### 4.8 Demo
On first load the app starts with the shift begun at 20:00 and seven notes **already processed** from stored operations (no AI call, so the first impression is instant): 21:15, 22:41 (with a photo chip), 22:52, 00:30, 01:30, 01:48 (filed as a possible incident at the cloakroom) and 02:52. Every fact in the demo report traces back to a demo note: the demo never shows the "AI" inventing anything.

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
  fromReport?: boolean                     // written in the Raport tab: no timestamp
  editedFrom?: string                      // text before an edit, until it is filed again
  status: 'pending' | 'processed' | 'failed'
  routedTo: string[]                       // labels for the routing tag
}

type EventTime = { hhmm: string; approx: boolean; sourcePhrase?: string }  // sourcePhrase: the manager's words, e.g. "koło 1", quoted in the tooltip   // calendar date derived from shift date (after midnight → next day)

type Incident = {
  id: string                               // stable; the AI references incidents by id
  createdAt: ISO                           // "dodano o"
  type: Field<string> | null               // predefined label or free text
  time: Field<EventTime> | null
  location: Field<string> | null           // predefined area or free text
  description: RichDoc | null             // same rich-text format and per-block authorship as sections
  attachments: Attachment[]
  sourceNoteIds: string[]
  suspected?: boolean                      // possible incident, until the manager confirms it
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
type Section = { key: SectionKey; doc: RichDoc; attachments: Attachment[] }   // "Bez uwag" = a manager block with that text

type GapTarget =
  | { kind: 'incident'; incidentId: string; field?: 'type' | 'time' | 'location' | 'description' }
  | { kind: 'section'; key: SectionKey }

type Gap = {                               // AI-origin gaps only; rule gaps are derived (§6.3)
  id: string; target: GapTarget; question: string
  weight: 'required' | 'optional'
  suggestion?: { value: string; reason: string }
  status: 'open' | 'answered' | 'dismissed'
}


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
  noIncidentsConfirmed: boolean            // "Brak incydentów" clicked
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
  | { op: 'addIncident'; type: string; time?: EventTime; location?: string; description: string; suspected?: boolean }
  | { op: 'updateIncident'; incidentId: string; type?: string; time?: EventTime; location?: string }
  | { op: 'appendToSection'; key: SectionKey; paragraphs: string[] }
  | { op: 'appendToIncident'; incidentId: string; text: string }          // adds a sentence to the description's last ai block, or a new block if the last one is manager-owned   // plain text; bullets via "- " prefix
  | { op: 'setSummary'; paragraphs: string[] }
  | { op: 'addGap'; target: GapTarget; question: string; weight: 'required' | 'optional'; suggestion?: { value: string; reason: string } }
  | { op: 'resolveGap'; gapId: string }
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

Plus report-level rule gaps:
- **required:** no incidents and `!noIncidentsConfirmed` → "Potwierdź: brak incydentów" (confirm: no incidents).
- **optional:** each empty fixed section (audience, security, maintenance) → shown as the section's own prompt and [Bez uwag], not as a chip.

### 6.4 Prompt and fallback
- **System prompt** (English instructions, Polish output). It covers:
  - the section keys with descriptions
  - the predefined incident types and venue areas (prefer them, free text allowed)
  - the incident minimums
  - weighting guidance:
    - required: injury → "was help given?"; violence or theft → "were police called?"; medical help → "who gave first aid?"
    - optional: a more precise location, witnesses, attaching evidence
  - never ask about a note; an unclear possible incident is added with suspected: true
  - the summary holds only confirmed facts: no possible incidents, estimates or open gaps (the report's controls show those)
  - never comment on the notes themselves; gibberish or test notes record nothing
  - never invent facts
  - mark approximate times `approx: true`
  - set the summary in 2–4 sentences
- **Scripted fallback:** canned operations for the demo phrases, plus a keyword heuristic (bójka, bił, kradzież, ukradł, zasłabł, karetka, policja, …) that creates an incident from the note text. If nothing matches, the note becomes `failed` with retry.
- **Model:** `gemini-3.8-flash` was verified with structured output on our key (about 10 s). During implementation we'll measure the `flash-lite` variants and pick the fastest that handles Polish well. The model id lives in one constant.
- **No server-side rate limiting.** The free-tier key has no billing. The fallback covers an exhausted quota.

---

## 7. Architecture and stack

- **Next.js (App Router) + TypeScript** on **Vercel**. Check the bundled Next docs before using any API.
- **Tailwind CSS + shadcn/ui** (brief constraint). Neutral theme, dark by default. Components used: Button, Popover, Calendar, Command (combobox), DropdownMenu, Dialog, Tabs, Tooltip, Sonner (toast), Avatar, Textarea, Badge.
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
  shift/     AppHeader (back, status, tabs, primary action), SendDialog, SentBanner
  journal/   Journal, JournalEntry (in-place edit)
  composer/  Composer (text, attach, mic), useSpeech (stretch)
  report/    ReportDocument, ReportHeader (date, author), IncidentBlock, TypeCombobox,
             TimePicker, PlacePicker, IncidentMenu, SectionEditor, GapChip, SectionHints
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
- **E2E (one Playwright spec, AI route mocked):** load the demo → add a note in Dziennik → it gets processed → edit it (Anuluj, then Zapisz) → switch to Raport → confirm the possible incident → answer a question chip → edit a section → confirm "Bez uwag" on Ochrona → duplicate and remove an incident (then undo) → "Wyślij raport" with a gap → the read-only view shows "brak danych".
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
  - real uploads

### Time budget (8 h)

| Block | Time |
|---|---|
| Design + spec | ~1:00 (spent) |
| Implementation plan | ~0:30 |
| Scaffold + deploy pipeline (empty app live) | ~0:30 |
| Domain logic + tests (types, operations, gaps, rich, seed, fallback) | ~1:15 |
| AI route + prompt + model choice | ~0:45 |
| UI: shell + tabs, journal, input, report document (properties, incidents with popovers, section editors, gaps, hints) | ~2:30 |
| Send flow, read-only view, phone polish | ~0:30 |
| Stretch: voice dictation | ~0:30 |
| E2E, polish, README | ~0:45 |

**Cut line, if behind, in this order:**
1. Voice dictation.
2. Duplicate (keep remove with undo).
3. Pre-filled AI suggestions in question-gap popovers (keep an empty answer field).
4. The time picker popover (keep a plain HH:MM input in the popover).

---

## 10. Open questions
None that block us. Decisions taken where the brief is silent are in §2.
