# Ławka

Ławka is a prototype of an AI-assisted shift report ("Raport ze zmiany") for night-club managers. During the shift the manager jots down quick, messy notes in Polish; the AI files them into a structured, editable report, so that at 3 a.m. the report is already nearly done and only needs a review and "Wyślij raport". The UI is in Polish, the code in English.

**Live:** _link coming soon_

## Run it

```bash
npm i
cp .env.example .env.local   # add a Google AI Studio key as GOOGLE_GENERATIVE_AI_API_KEY
npm run dev                  # http://localhost:3000
npm test                     # unit tests (Vitest)
npm run test:e2e             # end-to-end (Playwright, AI route mocked; Desktop Chrome + Pixel 7)
```

Without a key the app still runs, but only partly: a keyword-based fallback handles notes with common incident words (bójka, kradzież, zasłabł, karetka, …) and answers to questions; other notes are marked as failed and can be retried with "Ponów".

## Key decisions

- **Two modes, one column:** "Dziennik zmiany" (journal, for recording) and "Raport" (the document, for closing), the same layout on phone and laptop.
- **One input:** it always adds a note to the journal, in both tabs. Corrections are notes too.
- **Built continuously in the background:** one note at a time, so closing the shift never waits on a 30 s generation.
- **Structured data under a document-like UI:** fixed sections, incidents as records, rich text only inside sections. Stored as JSON, never one markdown blob.
- **Manual edits always win:** the AI never changes text or a field the manager has touched; notes are never edited or deleted.
- **Gaps have weight:** required (amber, counted in the badge) or optional (dashed, ignored in the count). The legal minimum for an incident (type, time, place, description) is enforced by code.
- **Explicit reply mode:** AI questions sit in a card above the input with quick replies; typing answers one only after "Odpowiedz".
- **Voice dictation:** a microphone button fills the input in Polish through the Web Speech API (dictation in Chrome/Safari); it never sends on its own.
- **Free tier, no backend:** Gemini free tier through the Vercel AI SDK with a scripted fallback for 503s; state in localStorage.

## How the AI works

Each note is sent to `/api/process-note` and the model returns a list of **operations** (add incident, append to section, add or resolve a gap, ask a question), not a whole report. `applyOperations` applies them to the shift, skipping anything the manager edited by hand, so nothing can be silently dropped. If the model fails or times out, the keyword-based fallback handles what it can; any other note is marked as failed and can be retried. Model: `gemini-3.1-flash-lite`, about 2 s per note.

## Co dalej

- Owner inbox and shift history
- PDF / insurer export
- Rating fields (e.g. for the night overall)
- Real file uploads instead of placeholder attachments

## Links

- Spec: [`docs/superpowers/specs/2026-11-09-shift-report-design.md`](docs/superpowers/specs/2026-11-09-shift-report-design.md)
- Plan: [`docs/superpowers/plans/2026-11-09-shift-report.md`](docs/superpowers/plans/2026-11-09-shift-report.md)
- Design canvas (private): https://claude.ai/artifact/3jojprCgVBaPsRuMua5Ykm
