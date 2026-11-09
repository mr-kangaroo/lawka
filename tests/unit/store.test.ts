import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyShift } from '@/lib/report/seed'
import { createIdGen } from '@/lib/report/ids'
import { openGaps } from '@/lib/report/gaps'
import { docToPlainText, hasManagerBlocks } from '@/lib/report/rich'
import type { Shift } from '@/lib/report/types'

const mem = vi.hoisted(() => {
  const data = new Map<string, string>()
  const shim = {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() {
      return data.size
    },
  }
  ;(globalThis as unknown as { localStorage: unknown }).localStorage = shim
  return { data }
})

vi.mock('@/lib/ai/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai/client')>('@/lib/ai/client')
  return { ...actual, requestOperations: vi.fn() }
})

async function load() {
  vi.resetModules()
  const { useShift } = await import('@/store/shift')
  const client = await import('@/lib/ai/client')
  const req = vi.mocked(client.requestOperations)
  const fresh = (): Shift => createEmptyShift(new Date(2026, 10, 8, 20, 0), createIdGen('t'))
  useShift.setState({ shift: fresh(), tab: 'journal', lastRemoved: undefined })
  return { useShift, req, fresh }
}

beforeEach(() => {
  mem.data.clear()
})

describe('store', () => {
  it('submitNote ignores whitespace-only text', async () => {
    const { useShift, req } = await load()
    await useShift.getState().submitNote('   ', [])
    expect(useShift.getState().shift.notes).toHaveLength(0)
    expect(req).not.toHaveBeenCalled()
  })

  it('submitNote adds a pending note then applies returned operations', async () => {
    const { useShift, req } = await load()
    let release!: (v: Awaited<ReturnType<typeof req>>) => void
    req.mockReturnValueOnce(new Promise((r) => (release = r)))
    const p = useShift.getState().submitNote('  Bójka przy wejściu  ', [])
    expect(useShift.getState().shift.notes[0]).toMatchObject({ text: 'Bójka przy wejściu', status: 'pending' })
    release({
      operations: [{ op: 'addIncident', type: 'Bójka', description: 'Bójka przy wejściu' }],
      source: 'ai',
    })
    await p
    const s = useShift.getState().shift
    expect(s.notes[0].status).toBe('processed')
    expect(s.incidents).toHaveLength(1)
  })

  it('submitNote marks the note failed when requestOperations rejects', async () => {
    const { useShift, req } = await load()
    req.mockRejectedValueOnce(new Error('boom'))
    await useShift.getState().submitNote('coś', [])
    expect(useShift.getState().shift.notes[0].status).toBe('failed')
  })

  it('retryNote re-requests and processes a failed note', async () => {
    const { useShift, req } = await load()
    req.mockRejectedValueOnce(new Error('boom'))
    await useShift.getState().submitNote('coś', [])
    const id = useShift.getState().shift.notes[0].id
    req.mockResolvedValueOnce({
      operations: [{ op: 'appendToSection', key: 'bar', paragraphs: ['Ok'] }],
      source: 'fallback',
    })
    await useShift.getState().retryNote(id)
    expect(req).toHaveBeenCalledTimes(2)
    expect(useShift.getState().shift.notes[0].status).toBe('processed')
    expect(useShift.getState().shift.sections.bar).toBeDefined()
  })

  it('results arriving after send() are ignored', async () => {
    const { useShift, req } = await load()
    let release!: (v: Awaited<ReturnType<typeof req>>) => void
    req.mockReturnValueOnce(new Promise((r) => (release = r)))
    const p = useShift.getState().submitNote('coś', [])
    useShift.getState().send()
    release({ operations: [{ op: 'addIncident', type: 'X', description: 'd' }], source: 'ai' })
    await p
    const s = useShift.getState().shift
    expect(s.notes[0].status).toBe('pending')
    expect(s.incidents).toHaveLength(0)
  })

  it('answering a gap marks it answered immediately and links the note', async () => {
    const { useShift, req, fresh } = await load()
    const base = fresh()
    useShift.setState({
      shift: {
        ...base,
        gaps: [
          {
            id: 'g1',
            target: { kind: 'section', key: 'bar' },
            question: 'Ile?',
            weight: 'optional',
            status: 'open',
          },
        ],
      },
    })
    let release!: (v: Awaited<ReturnType<typeof req>>) => void
    req.mockReturnValueOnce(new Promise((r) => (release = r)))
    const p = useShift.getState().submitNote('dwie', [], { answersGapId: 'g1' })
    const s = useShift.getState().shift
    expect(s.gaps[0].status).toBe('answered')
    expect(s.notes[0].answersGapId).toBe('g1')
    expect(req.mock.calls[0][1].answeringGap).toMatchObject({ id: 'g1', question: 'Ile?' })
    release({ operations: [], source: 'ai' })
    await p
  })

  it('setIncidentField makes the field manager-owned so a later updateIncident cannot overwrite it', async () => {
    const { useShift, req } = await load()
    req.mockResolvedValueOnce({
      operations: [{ op: 'addIncident', type: 'Bójka', description: 'd' }],
      source: 'ai',
    })
    await useShift.getState().submitNote('a', [])
    const inc = useShift.getState().shift.incidents[0]
    useShift.getState().setIncidentField(inc.id, 'type', 'Awaria')
    expect(useShift.getState().shift.incidents[0].type).toMatchObject({
      value: 'Awaria',
      prov: { by: 'manager' },
    })
    req.mockResolvedValueOnce({
      operations: [{ op: 'updateIncident', incidentId: inc.id, type: 'Inne' }],
      source: 'ai',
    })
    await useShift.getState().submitNote('b', [])
    expect(useShift.getState().shift.incidents[0].type!.value).toBe('Awaria')
  })

  it('removeIncident then undoRemove restores the incident at the same index', async () => {
    const { useShift } = await load()
    const st = useShift.getState()
    const a = st.addEmptyIncident()
    const b = useShift.getState().addEmptyIncident()
    const c = useShift.getState().addEmptyIncident()
    useShift.getState().removeIncident(b)
    expect(useShift.getState().shift.incidents.map((i) => i.id)).toEqual([a, c])
    useShift.getState().undoRemove()
    expect(useShift.getState().shift.incidents.map((i) => i.id)).toEqual([a, b, c])
    expect(useShift.getState().lastRemoved).toBeUndefined()
  })

  it('duplicateIncident inserts a manager-owned copy after the original', async () => {
    const { useShift, req } = await load()
    req.mockResolvedValueOnce({
      operations: [{ op: 'addIncident', type: 'Bójka', location: 'Wejście', description: 'Opis' }],
      source: 'ai',
    })
    await useShift.getState().submitNote('a', [])
    useShift.getState().addEmptyIncident()
    const orig = useShift.getState().shift.incidents[0]
    useShift.getState().duplicateIncident(orig.id)
    const incs = useShift.getState().shift.incidents
    expect(incs).toHaveLength(3)
    const copy = incs[1]
    expect(copy.id).not.toBe(orig.id)
    expect(copy.type!.prov.by).toBe('manager')
    expect(copy.location!.prov.by).toBe('manager')
    expect(hasManagerBlocks(copy.description!)).toBe(true)
  })

  it('confirmNoIncidents removes the rule:no-incidents gap', async () => {
    const { useShift } = await load()
    expect(openGaps(useShift.getState().shift).some((g) => g.id === 'rule:no-incidents')).toBe(true)
    useShift.getState().confirmNoIncidents()
    expect(openGaps(useShift.getState().shift).some((g) => g.id === 'rule:no-incidents')).toBe(false)
  })

  it('confirmNoRemarks writes "Bez uwag." as a manager block', async () => {
    const { useShift } = await load()
    useShift.getState().confirmNoRemarks('security')
    const doc = useShift.getState().shift.sections.security!.doc
    expect(docToPlainText(doc)).toBe('Bez uwag.')
    expect(hasManagerBlocks(doc)).toBe(true)
  })

  it('corrupt persisted JSON falls back to the demo shift', async () => {
    mem.data.set('lawka:v1', '{not json')
    vi.resetModules()
    const { useShift } = await import('@/store/shift')
    expect(useShift.getState().shift.id).toBe('demo-shift')
  })

  it('wrong persisted shape falls back to the demo shift', async () => {
    mem.data.set('lawka:v1', JSON.stringify({ state: { shift: { notes: 5 } }, version: 2 }))
    vi.resetModules()
    const { useShift } = await import('@/store/shift')
    expect(useShift.getState().shift.id).toBe('demo-shift')
  })

  it('persisted shift without sections falls back to the demo shift', async () => {
    const s = createEmptyShift(new Date(2026, 10, 8, 20, 0), createIdGen('p'))
    const { sections: _omit, ...noSections } = s
    void _omit
    mem.data.set('lawka:v1', JSON.stringify({ state: { shift: noSections, tab: 'journal' }, version: 2 }))
    vi.resetModules()
    const { useShift } = await import('@/store/shift')
    expect(useShift.getState().shift.id).toBe('demo-shift')
  })

  it('persisted shift with non-array gaps or questions falls back to the demo shift', async () => {
    const s = createEmptyShift(new Date(2026, 10, 8, 20, 0), createIdGen('p'))
    mem.data.set('lawka:v1', JSON.stringify({ state: { shift: { ...s, gaps: {} }, tab: 'journal' }, version: 2 }))
    vi.resetModules()
    const a = await import('@/store/shift')
    expect(a.useShift.getState().shift.id).toBe('demo-shift')
    mem.data.set('lawka:v1', JSON.stringify({ state: { shift: { ...s, questions: null }, tab: 'journal' }, version: 2 }))
    vi.resetModules()
    const b = await import('@/store/shift')
    expect(b.useShift.getState().shift.id).toBe('demo-shift')
  })

  it('v1 data (string routedTo labels) resets to the demo shift', async () => {
    const s = createEmptyShift(new Date(2026, 10, 8, 20, 0), createIdGen('p'))
    s.notes.push({ id: 'n1', createdAt: s.startedAt, text: 'a', attachments: [], status: 'processed', routedTo: ['Incydent #1'] as never })
    mem.data.set('lawka:v1', JSON.stringify({ state: { shift: s, tab: 'report' }, version: 1 }))
    vi.resetModules()
    const { useShift } = await import('@/store/shift')
    expect(useShift.getState().shift.id).toBe('demo-shift')
    expect(useShift.getState().tab).toBe('journal')
    expect(useShift.getState().shift.notes.every((n) => n.routedTo.every((t) => typeof t === 'object'))).toBe(true)
  })

  it('notes persisted as pending rehydrate as failed so they can be retried', async () => {
    const s = createEmptyShift(new Date(2026, 10, 8, 20, 0), createIdGen('p'))
    const base = { createdAt: s.startedAt, attachments: [], routedTo: [] }
    s.notes.push(
      { ...base, id: 'n-pending', text: 'a', status: 'pending' },
      { ...base, id: 'n-done', text: 'b', status: 'processed' },
    )
    mem.data.set('lawka:v1', JSON.stringify({ state: { shift: s, tab: 'report' }, version: 2 }))
    vi.resetModules()
    const { useShift } = await import('@/store/shift')
    const st = useShift.getState()
    expect(st.shift.id).toBe(s.id)
    expect(st.tab).toBe('report')
    expect(st.shift.notes.map((n) => n.status)).toEqual(['failed', 'processed'])
  })

  it('a throwing localStorage.setItem (quota) does not break actions', async () => {
    const { useShift } = await load()
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    try {
      expect(() => useShift.getState().confirmNoIncidents()).not.toThrow()
      expect(spy).toHaveBeenCalled()
      expect(useShift.getState().shift.noIncidentsConfirmed).toBe(true)
    } finally {
      spy.mockRestore()
    }
  })

  it('actions are no-ops after send() except newShift/loadDemo/setTab', async () => {
    const { useShift, req } = await load()
    useShift.getState().send()
    const sentAt = useShift.getState().shift.sentAt
    expect(sentAt).toBeDefined()
    const before = JSON.stringify(useShift.getState().shift)
    await useShift.getState().submitNote('x', [])
    useShift.getState().addEmptyIncident()
    useShift.getState().confirmNoIncidents()
    useShift.getState().confirmNoRemarks('bar')
    useShift.getState().setDate('2026-01-01')
    expect(JSON.stringify(useShift.getState().shift)).toBe(before)
    expect(req).not.toHaveBeenCalled()
    useShift.getState().setTab('report')
    expect(useShift.getState().tab).toBe('report')
    useShift.getState().newShift()
    expect(useShift.getState().shift.sentAt).toBeUndefined()
    useShift.getState().send()
    useShift.getState().loadDemo()
    expect(useShift.getState().shift.id).toBe('demo-shift')
  })
})

describe('buildContext', () => {
  it('lists manager-owned fields per incident', async () => {
    const { buildContext } = await import('@/lib/ai/client')
    const { useShift, fresh } = await load()
    const s = fresh()
    const prov = { by: 'manager' as const, at: s.startedAt, sourceNoteIds: [] }
    s.incidents.push({
      id: 'i1',
      createdAt: s.startedAt,
      type: { value: 'Bójka', prov },
      time: { value: { hhmm: '21:30', approx: false }, prov: { ...prov, by: 'ai' } },
      location: null,
      description: {
        type: 'doc',
        content: [{ type: 'paragraph', attrs: prov, content: [{ type: 'text', text: 'Opis' }] }],
      },
      attachments: [],
      sourceNoteIds: [],
    })
    void useShift
    const note = {
      id: 'n1', createdAt: s.startedAt, text: 't', attachments: [], status: 'pending' as const, routedTo: [],
    }
    const ctx = buildContext(s, note, new Date(2026, 10, 8, 22, 5))
    expect(ctx.incidents[0]).toMatchObject({
      id: 'i1', number: 1, type: 'Bójka', time: { hhmm: '21:30' },
      description: 'Opis', managerFields: ['type', 'description'],
    })
    expect(ctx.startHHMM).toBe('20:00')
    expect(ctx.nowHHMM).toBe('22:05')
    expect(ctx.shiftDate).toBe('2026-11-08')
  })

  it("buildContext sets noteHHMM from the note's local time", async () => {
    const { buildContext } = await import('@/lib/ai/client')
    const { fresh } = await load()
    const note = {
      id: 'n1', createdAt: new Date(2026, 10, 8, 23, 7).toISOString(), text: 't', attachments: [],
      status: 'pending' as const, routedTo: [],
    }
    const ctx = buildContext(fresh(), note, new Date(2026, 10, 8, 23, 40))
    expect(ctx.noteHHMM).toBe('23:07')
    expect(ctx.nowHHMM).toBe('23:40')
  })
})
