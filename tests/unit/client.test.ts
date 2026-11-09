import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestOperations, type AiContext } from '@/lib/ai/client'
import type { Note } from '@/lib/report/types'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('requestOperations', () => {
  it('passes a timeout AbortSignal to fetch', async () => {
    const fetchMock = vi.fn(async () => Response.json({ operations: [], source: 'ai' }))
    vi.stubGlobal('fetch', fetchMock)
    const note: Note = { id: 'n1', createdAt: '2026-11-08T22:00:00.000Z', text: 't', attachments: [], status: 'pending', routedTo: [] }
    const context: AiContext = {
      shiftDate: '2026-11-08', startHHMM: '20:00', nowHHMM: '23:00', noteHHMM: '23:00',
      incidents: [], sections: [], openGaps: [], openQuestions: [],
    }
    await expect(requestOperations(note, context)).resolves.toEqual({ operations: [], source: 'ai' })
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1]
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })
})
