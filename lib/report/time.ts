import type { ISO } from './types'

/** Parses "1:25", "01:25", "1.25", "0125" to "01:25"; null if invalid or outside 00:00-23:59. */
export function parseHHMM(input: string): string | null {
  const s = input.trim()
  let h: string
  let m: string
  const sep = /^(\d{1,2})[:.](\d{2})$/.exec(s)
  const compact = /^(\d{1,2})(\d{2})$/.exec(s)
  if (sep) [, h, m] = sep
  else if (compact) [, h, m] = compact
  else return null
  const hh = Number(h)
  const mm = Number(m)
  if (hh > 23 || mm > 59) return null
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Minutes since shift start; times earlier than the start count as after midnight. */
export function minutesFromShiftStart(hhmm: string, startHHMM: string): number {
  const diff = toMinutes(hhmm) - toMinutes(startHHMM)
  return diff >= 0 ? diff : diff + 24 * 60
}

/** Local HH:MM of an ISO timestamp. */
export function formatHHMM(iso: ISO): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const SLOT_MINUTES = 5
const DAY_MINUTES = 24 * 60

/** A full day of HH:MM slots in 5-minute steps, from the shift start (rounded down) past midnight. */
export function timeSlots(startHHMM: string): string[] {
  const first = toMinutes(startHHMM) - (toMinutes(startHHMM) % SLOT_MINUTES)
  return Array.from({ length: DAY_MINUTES / SLOT_MINUTES }, (_, i) => {
    const m = (first + i * SLOT_MINUTES) % DAY_MINUTES
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  })
}

const fmt = (minutes: number) => {
  const m = ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** Of `h` and `h + 12`, the hour that comes first after the shift start ("po 1" in a 20:00 shift is 01:xx). */
function nearestHour(h: number, startHHMM: string): number {
  if (h > 12) return h
  const am = h % 12
  return minutesFromShiftStart(fmt(am * 60), startHHMM) <= minutesFromShiftStart(fmt((am + 12) * 60), startHHMM)
    ? am
    : am + 12
}

/** Vague Polish time phrases, matched on lowercase text without diacritics. Order matters. */
const VAGUE: Array<{ re: RegExp; at: (h: number, m: number | null) => number }> = [
  { re: /\bpo (\d{1,2})(?:[:.](\d{2}))?(?!\d)/, at: (h, m) => h * 60 + (m === null ? 30 : m + 15) },
  { re: /\bprzed (\d{1,2})(?:[:.](\d{2}))?(?!\d)/, at: (h, m) => h * 60 + (m ?? 0) - 15 },
  { re: /\b(?:okolo|kolo|ok\.?|gdzies o|mniej wiecej o) (\d{1,2})(?:[:.](\d{2}))?(?!\d)/, at: (h, m) => h * 60 + (m ?? 0) },
]
const MIDNIGHT: Array<[RegExp, number]> = [
  [/\bprzed polnoca\b/, -15],
  [/\bpo polnocy\b/, 30],
  [/\b(?:o|kolo|okolo) polnocy\b/, 0],
]

/**
 * Estimates the time a vague phrase means: "po 1" → 01:30, "koło 1" → 01:00, "przed 2" → 01:45,
 * "przed północą" → 23:45. A bare hour is read as the one that comes first after the shift start.
 * Returns the matched phrase (as written) and the estimate, or null when there is no such phrase.
 */
export function estimateVagueTime(text: string, startHHMM: string): { phrase: string; hhmm: string } | null {
  const norm = text.toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/\p{Diacritic}/gu, '')
  // Normalization keeps one character per character, so match offsets map back onto `text`.
  const phraseAt = (m: RegExpExecArray) => text.slice(m.index, m.index + m[0].length)
  for (const [re, offset] of MIDNIGHT) {
    const m = re.exec(norm)
    if (m) return { phrase: phraseAt(m), hhmm: fmt(offset) }
  }
  for (const { re, at } of VAGUE) {
    const m = re.exec(norm)
    if (!m) continue
    const h = Number(m[1])
    const min = m[2] === undefined ? null : Number(m[2])
    if (h > 23 || (min !== null && min > 59)) continue
    return { phrase: phraseAt(m), hhmm: fmt(at(nearestHour(h, startHHMM), min)) }
  }
  return null
}

const WEEKDAYS_SHORT = ['Ndz', 'Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob']
const MONTHS_SHORT = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru']

/** "Pon 9 lis, 19:41": local weekday, day, month and time of an ISO timestamp. */
export function formatDayTime(iso: ISO): string {
  const d = new Date(iso)
  return `${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}, ${formatHHMM(iso)}`
}
