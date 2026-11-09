import type { AiContext } from '@/lib/ai/client'
import type { Operation } from '@/lib/report/operations'
import { normalizeForSearch } from '@/lib/report/search'
import { estimateVagueTime, parseHHMM } from '@/lib/report/time'
import type { EventTime, Note } from '@/lib/report/types'

/** Keyword heuristics on normalized text (lowercase, no diacritics), checked in order (spec §6.4). */
const KEYWORD_TYPES: Array<[RegExp, string]> = [
  // Fight verbs only as whole words ("bił się", "bili się", "pobił"), so "bilet" or "zgubił się" never match.
  [/bojk|bijatyk|awantur|\bpobil|\bbi(l[aoiy]?|ja|je) sie\b/, 'Bójka'],
  [/kradz|ukradl/, 'Kradzież'],
  [/zaslabl|karetk|omdl/, 'Zasłabnięcie / pomoc medyczna'],
]

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** "Czy wezwano policję?" + "nie" → "Czy wezwano policję? Nie." */
function questionAndAnswer(question: string, answer: string): string {
  const a = capitalize(answer.trim())
  return `${question.trim()} ${/[.!?…]$/.test(a) ? a : `${a}.`}`
}

/**
 * First whitespace-separated token that looks like a time with a separator ("23:10", "1.25"), trailing punctuation
 * ignored. Bare numbers ("300", "2026") are never read as times.
 */
function firstTime(text: string): string | null {
  for (const raw of text.split(/\s+/)) {
    const token = raw.replace(/^[(„"']+|[),;:!?"”'.]+$/g, '')
    const hhmm = /^\d{1,2}[:.]\d{2}$/.test(token) ? parseHHMM(token) : null
    if (hhmm) return hhmm
  }
  return null
}

/**
 * Scripted operations used when Gemini fails; null when nothing matches (the note then becomes `failed`).
 */
export function fallbackOperations(note: Note, context: AiContext): Operation[] | null {
  const gap = context.answeringGap
  if (gap) {
    const text = questionAndAnswer(gap.question, note.text)
    const ops: Operation[] = []
    if (gap.target.kind === 'incident') ops.push({ op: 'appendToIncident', incidentId: gap.target.incidentId, text })
    else if (gap.target.kind === 'section') ops.push({ op: 'appendToSection', key: gap.target.key, paragraphs: [text] })
    ops.push({ op: 'resolveGap', gapId: gap.id })
    return ops
  }

  const normalized = normalizeForSearch(note.text)
  const match = KEYWORD_TYPES.find(([re]) => re.test(normalized))
  if (!match) return null
  const hhmm = firstTime(note.text)
  const vague = hhmm ? null : estimateVagueTime(note.text, context.startHHMM)
  const time: EventTime = hhmm
    ? { hhmm, approx: false }
    : vague
      ? { hhmm: vague.hhmm, approx: true, sourcePhrase: vague.phrase }
      : { hhmm: context.noteHHMM, approx: true }
  return [{ op: 'addIncident', type: match[1], time, description: note.text }]
}
