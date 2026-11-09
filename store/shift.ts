import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { buildContext, requestOperations } from '@/lib/ai/client'
import { applyOperations } from '@/lib/report/operations'
import { retractNote } from '@/lib/report/retract'
import { appendBlocks, emptyDoc, paragraphsToBlocks } from '@/lib/report/rich'
import { createDemoShift, createEmptyShift } from '@/lib/report/seed'
import type {
  Attachment,
  BlockAttrs,
  EventTime,
  Field,
  Incident,
  RichDoc,
  SectionKey,
  Shift,
} from '@/lib/report/types'

type Tab = 'journal' | 'report'

export type ShiftState = {
  shift: Shift
  tab: Tab
  lastRemoved?: { incident: Incident; index: number }

  submitNote(
    text: string,
    attachments: Attachment[],
    opts?: { answersGapId?: string },
  ): Promise<void>
  retryNote(noteId: string): Promise<void>
  /** Saves a new text for a note and files it again (spec §4.2). */
  editNote(noteId: string, text: string): Promise<void>

  setTab(tab: Tab): void
  setDate(date: string): void
  setAuthor(personId: string): void
  setIncidentField(incidentId: string, field: 'type' | 'time' | 'location', value: string | EventTime): void
  setIncidentDescription(incidentId: string, doc: RichDoc): void
  addEmptyIncident(): string
  duplicateIncident(incidentId: string): void
  /** "Tak, to incydent": the AI's suspected incident is confirmed. */
  confirmIncident(incidentId: string): void
  removeIncident(incidentId: string): void
  undoRemove(): void
  confirmNoIncidents(): void

  setSectionDoc(key: SectionKey, doc: RichDoc): void
  addSection(key: SectionKey): void
  confirmNoRemarks(key: SectionKey): void
  dismissGap(gapId: string): void

  send(now?: Date): void
  newShift(): void
  loadDemo(): void
}

const newId = () => crypto.randomUUID()
const nowISO = () => new Date().toISOString()

function validShape(v: unknown): v is { shift: Shift; tab?: Tab } {
  const shift = (v as { shift?: Partial<Shift> } | null)?.shift
  return (
    !!shift &&
    Array.isArray(shift.notes) &&
    Array.isArray(shift.incidents) &&
    typeof shift.sections === 'object' &&
    shift.sections !== null &&
    !Array.isArray(shift.sections) &&
    Array.isArray(shift.gaps)
  )
}

/** A note still `pending` after a reload lost its request; mark it `failed` so it can be retried. */
function failInterruptedNotes(shift: Shift): Shift {
  if (!shift.notes.some((n) => n.status === 'pending')) return shift
  return {
    ...shift,
    notes: shift.notes.map((n) => (n.status === 'pending' ? { ...n, status: 'failed' as const } : n)),
  }
}

const baseStorage = createJSONStorage<{ shift: Shift; tab: Tab }>(() => localStorage)
const safeStorage: typeof baseStorage = baseStorage && {
  ...baseStorage,
  getItem: (name) => {
    try {
      return baseStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    try {
      return baseStorage.setItem(name, value)
    } catch {
      // Quota exceeded or storage blocked: keep the in-memory state.
    }
  },
}

export const useShift = create<ShiftState>()(
  persist(
    (set, get) => {
      /** Applies a change unless the shift was already sent. */
      const edit = (fn: (s: Shift) => void) => {
        const cur = get().shift
        if (cur.sentAt) return
        const next = structuredClone(cur)
        fn(next)
        set({ shift: next })
      }

      const ownedField = <T,>(value: T): Field<T> => ({
        value,
        prov: { by: 'manager', at: nowISO(), sourceNoteIds: [] },
      })

      const processNote = async (noteId: string) => {
        const shift = get().shift
        const note = shift.notes.find((n) => n.id === noteId)
        if (!note) return
        // An edited note replaces what its earlier version wrote; nothing changes unless the AI succeeds.
        const editing = note.editedFrom !== undefined
        const base = (s: Shift) => (editing ? retractNote(s, noteId) : s)
        try {
          const context = buildContext(base(shift), note, new Date())
          const { operations } = await requestOperations(note, context)
          const cur = get().shift
          if (cur.sentAt || !cur.notes.some((n) => n.id === noteId)) return
          const next = applyOperations(base(cur), operations, noteId, nowISO(), newId)
          if (editing) {
            const n = next.notes.find((x) => x.id === noteId)!
            delete n.editedFrom
            // Keep the incidents it was filed to, even when the edit changed nothing there.
            for (const id of context.editing?.incidentIds ?? []) {
              const exists = next.incidents.some((i) => i.id === id)
              if (exists && !n.routedTo.some((t) => t.kind === 'incident' && t.incidentId === id))
                n.routedTo.unshift({ kind: 'incident', incidentId: id })
            }
          }
          set({ shift: next })
        } catch {
          const cur = get().shift
          if (cur.sentAt || !cur.notes.some((n) => n.id === noteId)) return
          const next = structuredClone(cur)
          next.notes.find((n) => n.id === noteId)!.status = 'failed'
          set({ shift: next })
        }
      }

      return {
        shift: createDemoShift(),
        tab: 'journal',
        lastRemoved: undefined,

        async submitNote(text, attachments, opts) {
          const trimmed = text.trim()
          if (!trimmed && attachments.length === 0) return
          if (get().shift.sentAt) return
          const id = newId()
          edit((s) => {
            s.notes.push({
              id,
              createdAt: nowISO(),
              text: trimmed,
              attachments: structuredClone(attachments),
              ...(opts?.answersGapId ? { answersGapId: opts.answersGapId } : {}),
              ...(get().tab === 'report' || opts?.answersGapId ? { fromReport: true } : {}),
              status: 'pending',
              routedTo: [],
            })
            if (opts?.answersGapId) {
              const g = s.gaps.find((x) => x.id === opts.answersGapId)
              if (g) {
                g.status = 'answered'
                g.answeredByNoteId = id
              }
            }
          })
          await processNote(id)
        },

        async retryNote(noteId) {
          const note = get().shift.notes.find((n) => n.id === noteId)
          if (!note || note.status !== 'failed' || get().shift.sentAt) return
          edit((s) => {
            s.notes.find((n) => n.id === noteId)!.status = 'pending'
          })
          await processNote(noteId)
        },

        async editNote(noteId, text) {
          const trimmed = text.trim()
          const note = get().shift.notes.find((n) => n.id === noteId)
          if (!note || get().shift.sentAt || note.status === 'pending') return
          if (trimmed === note.text || (!trimmed && note.attachments.length === 0)) return
          edit((s) => {
            const n = s.notes.find((x) => x.id === noteId)!
            n.editedFrom ??= n.text
            n.text = trimmed
            n.status = 'pending'
          })
          await processNote(noteId)
        },

        setTab: (tab) => set({ tab }),
        setDate: (date) => edit((s) => void (s.date = date)),
        setAuthor: (personId) => edit((s) => void (s.authorId = personId)),

        setIncidentField(incidentId, field, value) {
          edit((s) => {
            const inc = s.incidents.find((i) => i.id === incidentId)
            if (!inc) return
            if (field === 'time') inc.time = ownedField(value as EventTime)
            else {
              // Blank text never counts as a value (D7); ignore it rather than store it.
              const text = (value as string).trim()
              if (text) inc[field] = ownedField(text)
            }
          })
        },

        setIncidentDescription(incidentId, doc) {
          edit((s) => {
            const inc = s.incidents.find((i) => i.id === incidentId)
            if (inc) inc.description = doc
          })
        },

        addEmptyIncident() {
          const id = newId()
          edit((s) => {
            s.incidents.push({
              id,
              createdAt: nowISO(),
              type: null,
              time: null,
              location: null,
              description: null,
              attachments: [],
              sourceNoteIds: [],
            })
          })
          return id
        },

        duplicateIncident(incidentId) {
          edit((s) => {
            const idx = s.incidents.findIndex((i) => i.id === incidentId)
            if (idx < 0) return
            const now = nowISO()
            const copy = structuredClone(s.incidents[idx])
            copy.id = newId()
            copy.createdAt = now
            for (const f of ['type', 'time', 'location'] as const) {
              const field = copy[f]
              if (field) field.prov = { ...field.prov, by: 'manager' }
            }
            if (copy.description) {
              for (const b of copy.description.content) b.attrs = { ...b.attrs, by: 'manager' }
            }
            s.incidents.splice(idx + 1, 0, copy)
          })
        },

        confirmIncident(incidentId) {
          edit((s) => {
            const inc = s.incidents.find((i) => i.id === incidentId)
            if (inc) delete inc.suspected
          })
        },

        removeIncident(incidentId) {
          const cur = get().shift
          if (cur.sentAt) return
          const index = cur.incidents.findIndex((i) => i.id === incidentId)
          if (index < 0) return
          const incident = cur.incidents[index]
          edit((s) => void s.incidents.splice(index, 1))
          set({ lastRemoved: { incident: structuredClone(incident), index } })
        },

        undoRemove() {
          const removed = get().lastRemoved
          if (!removed || get().shift.sentAt) return
          edit((s) => void s.incidents.splice(Math.min(removed.index, s.incidents.length), 0, removed.incident))
          set({ lastRemoved: undefined })
        },

        confirmNoIncidents: () => edit((s) => void (s.noIncidentsConfirmed = true)),

        setSectionDoc(key, doc) {
          edit((s) => {
            const sec = s.sections[key]
            if (sec) sec.doc = doc
            else s.sections[key] = { key, doc, attachments: [] }
          })
        },

        addSection(key) {
          edit((s) => {
            if (!s.sections[key]) s.sections[key] = { key, doc: emptyDoc(), attachments: [] }
          })
        },

        confirmNoRemarks(key) {
          edit((s) => {
            const attrs: BlockAttrs = { by: 'manager', at: nowISO(), sourceNoteIds: [] }
            const blocks = paragraphsToBlocks(['Bez uwag.'], attrs)
            const sec = s.sections[key]
            if (sec) sec.doc = appendBlocks(sec.doc, blocks)
            else s.sections[key] = { key, doc: appendBlocks(emptyDoc(), blocks), attachments: [] }
          })
        },

        dismissGap(gapId) {
          edit((s) => {
            const g = s.gaps.find((x) => x.id === gapId)
            if (g && g.weight === 'optional') g.status = 'dismissed'
          })
        },

        send(now = new Date()) {
          edit((s) => void (s.sentAt = now.toISOString()))
        },
        newShift: () =>
          set({ shift: createEmptyShift(new Date(), newId), tab: 'journal', lastRemoved: undefined }),
        loadDemo: () => set({ shift: createDemoShift(), tab: 'journal', lastRemoved: undefined }),
      }
    },
    {
      name: 'lawka:v1',
      // v2: Note.routedTo holds RouteTarget objects (v1 stored label strings).
      // v3: AI questions replaced by suspected incidents. Older data resets to the demo.
      version: 3,
      storage: safeStorage,
      partialize: (s) => ({ shift: s.shift, tab: s.tab }),
      migrate: () => ({ shift: createDemoShift(), tab: 'journal' as Tab }),
      merge: (persisted, current) =>
        validShape(persisted)
          ? {
              ...current,
              shift: failInterruptedNotes(persisted.shift),
              tab: persisted.tab === 'report' ? 'report' : 'journal',
            }
          : { ...current, shift: createDemoShift() },
    },
  ),
)
