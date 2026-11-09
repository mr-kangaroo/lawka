import { describe, expect, it } from 'vitest'
import { jumpTargetFor } from '@/lib/report/gap-target'

describe('jumpTargetFor', () => {
  it('maps an incident field gap to the incident and that field', () => {
    const t = jumpTargetFor({ kind: 'incident', incidentId: 'i2', field: 'time' })
    expect(t.elementId).toBe('incident-i2')
    expect(t.focus).toContain('Godzina zdarzenia')
  })
  it('maps an incident gap without a field to the incident only', () => {
    expect(jumpTargetFor({ kind: 'incident', incidentId: 'i2' })).toEqual({ elementId: 'incident-i2' })
  })
  it('maps a section gap to its section', () => {
    expect(jumpTargetFor({ kind: 'section', key: 'security' }).elementId).toBe('section-security')
  })
  it('maps the report-level gap to the Incydenty area', () => {
    expect(jumpTargetFor({ kind: 'report' }).elementId).toBe('incidents')
  })
})
