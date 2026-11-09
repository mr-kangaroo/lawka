import { z } from 'zod'
import { SECTION_LABELS } from './catalog'
import type { IdGen } from './ids'
import {
  appendBlocks,
  appendSentence,
  emptyDoc,
  hasManagerBlocks,
  paragraphsToBlocks,
  replaceAiBlocks,
} from './rich'
import { formatHHMM, minutesFromShiftStart } from './time'
import type {
  Attachment,
  BlockAttrs,
  EventTime,
  Field,
  Gap,
  ISO,
  Incident,
  Section,
  SectionKey,
  Shift,
} from './types'

const SECTION_KEYS = [
  'summary', 'audience', 'security', 'artists', 'doorStaff', 'production',
  'bar', 'kitchen', 'suppliers', 'privateEvents', 'maintenance', 'stock',
] as const satisfies readonly SectionKey[]

const SectionKeySchema = z.enum(SECTION_KEYS)

const EventTimeSchema = z.object({
  hhmm: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  approx: z.boolean(),
  sourcePhrase: z.string().optional(),
})

const GapTargetSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('incident'),
    incidentId: z.string(),
    field: z.enum(['type', 'time', 'location', 'description']).optional(),
  }),
  z.object({ kind: z.literal('section'), key: SectionKeySchema }),
])

export const OperationSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('addIncident'),
    type: z.string(),
    time: EventTimeSchema.optional(),
    location: z.string().optional(),
    description: z.string(),
  }),
  z.object({
    op: z.literal('updateIncident'),
    incidentId: z.string(),
    type: z.string().optional(),
    time: EventTimeSchema.optional(),
    location: z.string().optional(),
  }),
  z.object({ op: z.literal('appendToSection'), key: SectionKeySchema, paragraphs: z.array(z.string()) }),
  z.object({ op: z.literal('appendToIncident'), incidentId: z.string(), text: z.string() }),
  z.object({ op: z.literal('setSummary'), paragraphs: z.array(z.string()) }),
  z.object({
    op: z.literal('addGap'),
    target: GapTargetSchema,
    question: z.string(),
    weight: z.enum(['required', 'optional']),
    suggestion: z.object({ value: z.string(), reason: z.string() }).optional(),
  }),
  z.object({ op: z.literal('resolveGap'), gapId: z.string() }),
  z.object({ op: z.literal('askQuestion'), question: z.string(), options: z.array(z.string()) }),
])

export const OperationsResponseSchema = z.object({ operations: z.array(OperationSchema) })

export type Operation = z.infer<typeof OperationSchema>

/** Incidents in display order: by time since shift start; untimed last, by createdAt. Display number = index + 1. */
export function sortIncidents(shift: Shift): Incident[] {
  const start = formatHHMM(shift.startedAt)
  const timed = shift.incidents
    .filter((i) => i.time)
    .sort(
      (a, b) =>
        minutesFromShiftStart(a.time!.value.hhmm, start) - minutesFromShiftStart(b.time!.value.hhmm, start),
    )
  const untimed = shift.incidents
    .filter((i) => !i.time)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return [...timed, ...untimed]
}

type Target = { kind: 'incident'; id: string } | { kind: 'section'; key: SectionKey }

export function applyOperations(
  shift: Shift,
  ops: Operation[],
  noteId: string,
  now: ISO,
  newId: IdGen,
): Shift {
  const s: Shift = structuredClone(shift)
  const note = s.notes.find((n) => n.id === noteId)
  const attrs = (): BlockAttrs => ({ by: 'ai', at: now, sourceNoteIds: [noteId] })
  const aiField = <T>(value: T): Field<T> => ({ value, prov: { by: 'ai', at: now, sourceNoteIds: [noteId] } })
  const noteAttachments: Attachment[] = note ? structuredClone(note.attachments) : []

  const targets: Target[] = []
  const touch = (t: Target) => {
    if (!targets.some((x) => JSON.stringify(x) === JSON.stringify(t))) targets.push(t)
  }
  const addSource = (inc: Incident) => {
    if (!inc.sourceNoteIds.includes(noteId)) inc.sourceNoteIds.push(noteId)
  }
  let incidentGotAttachments = false
  let firstFedSection: SectionKey | null = null
  const giveAttachmentsToIncident = (inc: Incident) => {
    if (incidentGotAttachments) return
    incidentGotAttachments = true
    for (const a of noteAttachments) if (!inc.attachments.some((x) => x.id === a.id)) inc.attachments.push(a)
  }
  const getSection = (key: SectionKey): Section => {
    let sec = s.sections[key]
    if (!sec) {
      sec = { key, doc: emptyDoc(), attachments: [] }
      s.sections[key] = sec
    }
    return sec
  }
  const setField = <T>(current: Field<T> | null, value: T): Field<T> | undefined =>
    current === null || current.prov.by !== 'manager' ? aiField(value) : undefined

  for (const op of ops) {
    switch (op.op) {
      case 'addIncident': {
        const inc: Incident = {
          id: newId(),
          createdAt: note?.createdAt ?? now,
          type: aiField(op.type),
          time: op.time ? aiField<EventTime>({ ...op.time }) : null,
          location: op.location !== undefined ? aiField(op.location) : null,
          description: { type: 'doc', content: paragraphsToBlocks([op.description], attrs()) },
          attachments: [],
          sourceNoteIds: [noteId],
        }
        giveAttachmentsToIncident(inc)
        s.incidents.push(inc)
        s.noIncidentsConfirmed = false
        touch({ kind: 'incident', id: inc.id })
        break
      }
      case 'updateIncident': {
        const inc = s.incidents.find((i) => i.id === op.incidentId)
        if (!inc) break
        let changed = false
        if (op.type !== undefined) {
          const f = setField(inc.type, op.type)
          if (f) { inc.type = f; changed = true }
        }
        if (op.time !== undefined) {
          const f = setField(inc.time, { ...op.time } as EventTime)
          if (f) { inc.time = f; changed = true }
        }
        if (op.location !== undefined) {
          const f = setField(inc.location, op.location)
          if (f) { inc.location = f; changed = true }
        }
        if (changed) {
          addSource(inc)
          touch({ kind: 'incident', id: inc.id })
        }
        break
      }
      case 'appendToIncident': {
        const inc = s.incidents.find((i) => i.id === op.incidentId)
        if (!inc) break
        inc.description = appendSentence(inc.description ?? emptyDoc(), op.text, attrs())
        addSource(inc)
        giveAttachmentsToIncident(inc)
        touch({ kind: 'incident', id: inc.id })
        break
      }
      case 'appendToSection': {
        const sec = getSection(op.key)
        sec.doc = appendBlocks(sec.doc, paragraphsToBlocks(op.paragraphs, attrs()))
        firstFedSection ??= op.key
        touch({ kind: 'section', key: op.key })
        break
      }
      case 'setSummary': {
        const sec = getSection('summary')
        if (hasManagerBlocks(sec.doc)) break
        sec.doc = replaceAiBlocks(sec.doc, paragraphsToBlocks(op.paragraphs, attrs()))
        firstFedSection ??= 'summary'
        touch({ kind: 'section', key: 'summary' })
        break
      }
      case 'addGap': {
        const dup = s.gaps.some(
          (g) =>
            g.status === 'open' &&
            g.question === op.question &&
            JSON.stringify(g.target) === JSON.stringify(op.target),
        )
        if (dup) break
        const gap: Gap = {
          id: newId(),
          target: op.target,
          question: op.question,
          weight: op.weight,
          status: 'open',
          ...(op.suggestion ? { suggestion: op.suggestion } : {}),
        }
        s.gaps.push(gap)
        break
      }
      case 'resolveGap': {
        const gap = s.gaps.find((g) => g.id === op.gapId)
        if (gap) gap.status = 'answered'
        break
      }
      case 'askQuestion':
        s.questions.push({ id: newId(), noteId, question: op.question, options: op.options, status: 'open' })
        break
    }
  }

  if (!incidentGotAttachments && firstFedSection && noteAttachments.length) {
    const sec = getSection(firstFedSection)
    for (const a of noteAttachments) if (!sec.attachments.some((x) => x.id === a.id)) sec.attachments.push(a)
  }

  if (note) {
    const sorted = sortIncidents(s)
    note.status = 'processed'
    note.routedTo = targets.map((t) =>
      t.kind === 'section'
        ? SECTION_LABELS[t.key]
        : `Incydent #${sorted.findIndex((i) => i.id === t.id) + 1}`,
    )
    if (note.replyTo) {
      const q = s.questions.find((x) => x.id === note.replyTo)
      if (q) q.status = 'answered'
    }
    if (note.answersGapId) {
      const g = s.gaps.find((x) => x.id === note.answersGapId)
      if (g) {
        g.status = 'answered'
        g.answeredByNoteId = noteId
      }
    }
  }
  return s
}
