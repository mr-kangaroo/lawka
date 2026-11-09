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
