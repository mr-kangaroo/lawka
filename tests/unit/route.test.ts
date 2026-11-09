import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/ai/gemini', () => ({
  generateOperations: vi.fn(async () => {
    throw new Error('unavailable')
  }),
}))

const { POST } = await import('@/app/api/process-note/route')

const body = (noteOver: Record<string, unknown> = {}, contextOver: Record<string, unknown> = {}) => ({
  note: {
    id: 'r1', createdAt: '2026-11-09T01:05:00.000Z', text: 'notatka', attachments: [],
    status: 'pending', routedTo: [], ...noteOver,
  },
  context: {
    shiftDate: '2026-11-08', startHHMM: '20:00', nowHHMM: '02:05', noteHHMM: '02:05',
    incidents: [], sections: [], openGaps: [], ...contextOver,
  },
})
const post = (b: unknown) =>
  POST(new Request('http://localhost/api/process-note', { method: 'POST', body: JSON.stringify(b) }))

describe('POST /api/process-note', () => {
  it('answers through the fallback when the AI fails', async () => {
    const res = await post(body({ text: 'bójka przy barze po 1' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      source: 'fallback',
      operations: [
        { op: 'addIncident', type: 'Bójka', time: { hhmm: '01:30', approx: true, sourcePhrase: 'po 1' }, description: 'bójka przy barze po 1' },
      ],
    })
  })

  it('never uses the scripted fallback for an edited note', async () => {
    const res = await post(body({ text: 'bójka przy barze' }, { editing: { previousText: 'bójka', incidentIds: ['i1'] } }))
    expect(res.status).toBe(422)
  })

  it('rejects oversized input', async () => {
    expect((await post(body({ text: 'x'.repeat(4001) }))).status).toBe(400)
    expect((await post(body({}, { sections: [{ key: 'bar', text: 'x'.repeat(8001), hasManagerBlocks: false }] }))).status).toBe(400)
    const many = Array.from({ length: 101 }, (_, i) => ({ id: `g${i}`, question: '?', target: { kind: 'report' } }))
    expect((await post(body({}, { openGaps: many }))).status).toBe(400)
  })
})
