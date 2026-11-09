import { EMPTY_SECTION_PROMPTS, INCIDENT_FIELD_QUESTIONS } from './catalog'
import { isDocEmpty } from './rich'
import type { Gap, GapTarget, Incident, SectionKey, Shift } from './types'

export type DerivedGap = {
  id: string
  target: GapTarget | { kind: 'report' }
  question: string
  weight: 'required' | 'optional'
  origin: 'rule' | 'ai'
  suggestion?: Gap['suggestion']
}

type IncidentField = 'type' | 'time' | 'location' | 'description'
const FIELDS: IncidentField[] = ['type', 'time', 'location', 'description']
const EMPTY_CHECKED: SectionKey[] = ['audience', 'security', 'maintenance']

function fieldMissing(inc: Incident, field: IncidentField): boolean {
  switch (field) {
    case 'type':
    case 'location': {
      const f = inc[field]
      return !f || !f.value.trim()
    }
    case 'time': return inc.time === null || inc.time.value.approx
    case 'description': return inc.description === null || isDocEmpty(inc.description)
  }
}

function incidentFieldGap(inc: Incident, field: IncidentField): DerivedGap {
  return {
    id: `rule:${inc.id}:${field}`,
    target: { kind: 'incident', incidentId: inc.id, field },
    question: INCIDENT_FIELD_QUESTIONS[field],
    weight: 'required',
    origin: 'rule',
  }
}

export function ruleGaps(shift: Shift): DerivedGap[] {
  const gaps: DerivedGap[] = []
  for (const inc of shift.incidents) {
    for (const f of FIELDS) if (fieldMissing(inc, f)) gaps.push(incidentFieldGap(inc, f))
  }
  if (shift.incidents.length === 0 && !shift.noIncidentsConfirmed) {
    gaps.push({
      id: 'rule:no-incidents',
      target: { kind: 'report' },
      question: 'Potwierdź: brak incydentów',
      weight: 'required',
      origin: 'rule',
    })
  }
  for (const key of EMPTY_CHECKED) {
    const sec = shift.sections[key]
    if (!sec || isDocEmpty(sec.doc)) {
      gaps.push({
        id: `rule:empty:${key}`,
        target: { kind: 'section', key },
        question: EMPTY_SECTION_PROMPTS[key] ?? '',
        weight: 'optional',
        origin: 'rule',
      })
    }
  }
  return gaps
}

/**
 * Whether a stored AI gap still counts. Derived on every read (never written back), so putting
 * a removed incident back with "Cofnij" brings its gaps back.
 * - An incident gap whose incident no longer exists does not count.
 * - An incident *field* gap never counts on its own: while the field is missing the rule gap
 *   ("Gdzie?", …) stands in for it, and once the field has a value it is resolved.
 */
function aiGapApplies(shift: Shift, g: Gap): boolean {
  if (g.target.kind !== 'incident') return true
  const { incidentId, field } = g.target
  if (!shift.incidents.some((i) => i.id === incidentId)) return false
  return !field
}

export function openGaps(shift: Shift): DerivedGap[] {
  const ai: DerivedGap[] = shift.gaps
    .filter((g) => g.status === 'open' && aiGapApplies(shift, g))
    .map((g) => ({
      id: g.id,
      target: g.target,
      question: g.question,
      weight: g.weight,
      origin: 'ai' as const,
      ...(g.suggestion ? { suggestion: g.suggestion } : {}),
    }))
  return [...ruleGaps(shift), ...ai]
}

export function requiredCount(shift: Shift): number {
  return openGaps(shift).filter((g) => g.weight === 'required').length
}

export function fieldGap(shift: Shift, incidentId: string, field: IncidentField): DerivedGap | undefined {
  const inc = shift.incidents.find((i) => i.id === incidentId)
  return inc && fieldMissing(inc, field) ? incidentFieldGap(inc, field) : undefined
}
