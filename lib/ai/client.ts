import { openGaps, type DerivedGap } from '@/lib/report/gaps'
import { OperationsResponseSchema, sortIncidents, type Operation } from '@/lib/report/operations'
import { docToPlainText, hasManagerBlocks } from '@/lib/report/rich'
import { formatHHMM } from '@/lib/report/time'
import type { EventTime, GapTarget, Note, SectionKey, Shift } from '@/lib/report/types'

type GapRef = { id: string; question: string; target: GapTarget | { kind: 'report' } }

export type AiContext = {
  shiftDate: string
  startHHMM: string
  nowHHMM: string
  /** The note's local HH:MM, computed on the client (the server may run in UTC). */
  noteHHMM: string
  incidents: Array<{
    id: string
    number: number
    type?: string
    time?: EventTime
    location?: string
    description: string
    managerFields: string[]
  }>
  sections: Array<{ key: SectionKey; text: string; hasManagerBlocks: boolean }>
  openGaps: GapRef[]
  openQuestions: Array<{ id: string; question: string }>
  answeringGap?: GapRef
}

const toRef = (g: Pick<DerivedGap, 'id' | 'question' | 'target'>): GapRef => ({
  id: g.id,
  question: g.question,
  target: g.target,
})

/** Compact snapshot of the shift for the AI route (spec §6.1). */
export function buildContext(shift: Shift, note: Note, now: Date): AiContext {
  const incidents = sortIncidents(shift).map((inc, i) => {
    const managerFields: string[] = []
    if (inc.type?.prov.by === 'manager') managerFields.push('type')
    if (inc.time?.prov.by === 'manager') managerFields.push('time')
    if (inc.location?.prov.by === 'manager') managerFields.push('location')
    if (inc.description && hasManagerBlocks(inc.description)) managerFields.push('description')
    return {
      id: inc.id,
      number: i + 1,
      ...(inc.type ? { type: inc.type.value } : {}),
      ...(inc.time ? { time: inc.time.value } : {}),
      ...(inc.location ? { location: inc.location.value } : {}),
      description: inc.description ? docToPlainText(inc.description) : '',
      managerFields,
    }
  })
  const sections = Object.values(shift.sections).map((s) => ({
    key: s.key,
    text: docToPlainText(s.doc),
    hasManagerBlocks: hasManagerBlocks(s.doc),
  }))
  const open = openGaps(shift)
  let answeringGap: GapRef | undefined
  if (note.answersGapId) {
    const ai = shift.gaps.find((g) => g.id === note.answersGapId)
    const found = ai ?? open.find((g) => g.id === note.answersGapId)
    if (found) answeringGap = toRef(found)
  }
  return {
    shiftDate: shift.date,
    startHHMM: formatHHMM(shift.startedAt),
    nowHHMM: formatHHMM(now.toISOString()),
    noteHHMM: formatHHMM(note.createdAt),
    incidents,
    sections,
    openGaps: open.map(toRef),
    openQuestions: shift.questions.filter((q) => q.status === 'open').map((q) => ({ id: q.id, question: q.question })),
    ...(answeringGap ? { answeringGap } : {}),
  }
}

export async function requestOperations(
  note: Note,
  context: AiContext,
): Promise<{ operations: Operation[]; source: 'ai' | 'fallback' }> {
  const res = await fetch('/api/process-note', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ note, context }),
    signal: AbortSignal.timeout(25000),
  })
  if (!res.ok) throw new Error(`process-note failed: ${res.status}`)
  const json = await res.json()
  const { operations } = OperationsResponseSchema.parse(json)
  const source = json?.source === 'fallback' ? 'fallback' : 'ai'
  return { operations, source }
}
