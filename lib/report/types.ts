export type ISO = string // ISO-8601 timestamp
export type Author = 'ai' | 'manager'
export type Provenance = { by: Author; at: ISO; sourceNoteIds: string[] } // stored, never displayed
export type Field<T> = { value: T; prov: Provenance }

export type Attachment = { id: string; name: string; kind: 'image' | 'video' | 'document' } // fake

/** Where a note was filed. Labels ("Incydent #2") are derived at render time by `routeLabel`. */
export type RouteTarget = { kind: 'incident'; incidentId: string } | { kind: 'section'; key: SectionKey }

export type Note = {
  id: string
  createdAt: ISO
  text: string
  attachments: Attachment[]
  answersGapId?: string // the note answers a question chip
  fromReport?: boolean // written in the Raport tab (a correction or an answer): shown without a time
  editedFrom?: string // text before the manager's edit, until the edited note has been filed again
  status: 'pending' | 'processed' | 'failed'
  routedTo: RouteTarget[] // targets for the routing tag, deduped, in order
}

// sourcePhrase: the manager's words, e.g. "koło 1", quoted in the tooltip.
// Calendar date is derived from the shift date (after midnight -> next day).
export type EventTime = { hhmm: string; approx: boolean; sourcePhrase?: string }

export type Incident = {
  id: string // stable; the AI references incidents by id
  createdAt: ISO // "dodano o"
  type: Field<string> | null
  time: Field<EventTime> | null
  location: Field<string> | null
  description: RichDoc | null
  attachments: Attachment[]
  sourceNoteIds: string[]
  /** The AI thinks this may be an incident; the manager confirms or removes it in the report. */
  suspected?: boolean
}

export type SectionKey =
  | 'summary'
  | 'audience'
  | 'security'
  | 'artists'
  | 'doorStaff'
  | 'production'
  | 'bar'
  | 'kitchen'
  | 'suppliers'
  | 'privateEvents'
  | 'maintenance'
  | 'stock'

// Tiptap/ProseMirror JSON restricted to paragraph, bulletList, listItem, text, marks bold/italic.
// Every top-level block carries attrs { by, at, sourceNoteIds }.
export type BlockAttrs = { by: Author; at: ISO; sourceNoteIds: string[] }
export type RichInline = { type: 'text'; text: string; marks?: { type: 'bold' | 'italic' }[] }
export type RichBlock =
  | { type: 'paragraph'; attrs: BlockAttrs; content?: RichInline[] }
  | {
      type: 'bulletList'
      attrs: BlockAttrs
      content: { type: 'listItem'; content: { type: 'paragraph'; content?: RichInline[] }[] }[]
    }
export type RichDoc = { type: 'doc'; content: RichBlock[] }

export type Section = { key: SectionKey; doc: RichDoc; attachments: Attachment[] }

export type GapTarget =
  | { kind: 'incident'; incidentId: string; field?: 'type' | 'time' | 'location' | 'description' }
  | { kind: 'section'; key: SectionKey }

export type Gap = {
  id: string
  target: GapTarget
  question: string
  weight: 'required' | 'optional'
  suggestion?: { value: string; reason: string }
  status: 'open' | 'answered' | 'dismissed'
  answeredByNoteId?: string
}

export type Person = {
  id: string
  name: string
  role: string
  initials: string
  tone: 'blue' | 'teal' | 'purple' | 'pink' // avatar colour
}

export type Shift = {
  id: string
  date: string // YYYY-MM-DD, shift start date
  startedAt: ISO
  authorId: string
  sentAt?: ISO
  notes: Note[]
  incidents: Incident[]
  sections: Partial<Record<SectionKey, Section>>
  gaps: Gap[]
  noIncidentsConfirmed: boolean // "Brak incydentów" clicked
}
