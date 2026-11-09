import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/ai/gemini', () => ({
  generateOperations: vi.fn(async () => {
    throw new Error('unavailable')
  }),
}))

const { POST } = await import('@/app/api/process-note/route')

const body = (noteOver: Record<string, unknown> = {}, contextOver: Record<string, unknown> = {}) => ({
  note: {
    id: 'r1', createdAt: '2026-11-09T01:05:00.000Z', text: 'Tak, zapisz jako incydent', attachments: [],
    status: 'pending', routedTo: [], ...noteOver,
  },
  context: {
    shiftDate: '2026-11-08', startHHMM: '20:00', nowHHMM: '02:05', noteHHMM: '02:05',
    incidents: [], sections: [], openGaps: [], openQuestions: [], ...contextOver,
  },
})
const post = (b: unknown) =>
  POST(new Request('http://localhost/api/process-note', { method: 'POST', body: JSON.stringify(b) }))

describe('POST /api/process-note', () => {
  it('accepts answeringQuestion and answers a reply through the fallback', async () => {
    const res = await post(
      body({ replyTo: 'q1' }, {
        answeringQuestion: {
          id: 'q1', question: 'Czy to był incydent?', options: ['Tak, zapisz jako incydent', 'Nie, tylko informacja'],
          noteText: 'znowu ten typ przy szatni', noteHHMM: '01:48',
        },
      }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      source: 'fallback',
      operations: [
        { op: 'addIncident', type: 'Inne', time: { hhmm: '01:48', approx: true }, description: 'znowu ten typ przy szatni' },
      ],
    })
  })

  it('rejects oversized input', async () => {
    expect((await post(body({ text: 'x'.repeat(4001) }))).status).toBe(400)
    expect((await post(body({}, { sections: [{ key: 'bar', text: 'x'.repeat(8001), hasManagerBlocks: false }] }))).status).toBe(400)
    const many = Array.from({ length: 101 }, (_, i) => ({ id: `q${i}`, question: '?' }))
    expect((await post(body({}, { openQuestions: many }))).status).toBe(400)
  })
})
