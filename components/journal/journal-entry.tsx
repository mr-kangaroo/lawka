'use client'

import { LoaderCircleIcon } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { formatHHMM } from '@/lib/report/time'
import type { Note } from '@/lib/report/types'
import { useShift } from '@/store/shift'
import { AttachmentChip } from './attachment-chip'

function EntryStatus({ note, routeLabels }: EntryProps) {
  const retryNote = useShift((s) => s.retryNote)
  const sent = useShift((s) => Boolean(s.shift.sentAt))

  // After sending nothing is processed any more: no spinner, no "Ponów".
  if (sent && note.status !== 'processed')
    return <span className="text-[13px] text-muted-foreground">nie przetworzono</span>
  if (note.status === 'pending')
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground italic">
        <LoaderCircleIcon className="size-3 animate-spin" aria-hidden />
        porządkuję…
      </span>
    )
  if (note.status === 'failed')
    return (
      <span className="inline-flex items-center gap-1 text-[13px] text-muted-foreground">
        Nie udało się uporządkować ·
        <Button
          variant="link"
          size="xs"
          className="relative h-auto px-0 text-[13px] text-foreground before:absolute before:-inset-x-2 before:-inset-y-3"
          onClick={() => void retryNote(note.id)}
        >
          Ponów
        </Button>
      </span>
    )
  if (routeLabels.length > 0)
    return <span className="text-[13px] text-muted-foreground">{routeLabels.join(' · ')}</span>
  return null
}

export type EntryProps = {
  note: Note
  /** Current labels of `note.routedTo` (see `routeLabel`), removed incidents already skipped. */
  routeLabels: string[]
}

/** Small action buttons under a note being edited; 44 px hit area on phones. */
const EDIT_BUTTON = 'relative h-7 px-2.5 text-[13px] max-sm:before:absolute max-sm:before:inset-x-0 max-sm:before:-inset-y-2'

/**
 * One journal note: time column, text, attachment chips and the status line (spec §4.2).
 * Clicking the text edits it in place; "Anuluj / Zapisz" replace the status line while editing.
 */
export function JournalEntry({ note, routeLabels }: EntryProps) {
  const editNote = useShift((s) => s.editNote)
  const sent = useShift((s) => Boolean(s.shift.sentAt))
  const [draft, setDraft] = useState<string | null>(null)
  const editing = draft !== null
  const canEdit = !sent && note.status !== 'pending'
  const hasMeta = note.attachments.length > 0 || note.status !== 'processed' || routeLabels.length > 0

  const save = () => {
    if (draft === null) return
    if (draft.trim() || note.attachments.length > 0) void editNote(note.id, draft)
    setDraft(null)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setDraft(null)
    } else if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      save()
    }
  }

  return (
    <li className="grid grid-cols-[44px_minmax(0,1fr)] gap-3 border-b border-border/50 py-3 sm:grid-cols-[56px_minmax(0,1fr)]">
      {note.fromReport ? (
        <span aria-hidden />
      ) : (
        <time dateTime={note.createdAt} className="pt-0.5 text-[13px] text-muted-foreground tabular-nums">
          {formatHHMM(note.createdAt)}
        </time>
      )}
      <div className="flex flex-col gap-1.5">
        {editing ? (
          <textarea
            aria-label="Edytuj notatkę"
            value={draft}
            autoFocus
            onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            className="-mx-2 -my-1 resize-none rounded-md border border-input bg-muted/40 px-2 py-1 outline-none [field-sizing:content] focus:border-ring"
          />
        ) : note.text && canEdit ? (
          <button
            type="button"
            aria-label={`Edytuj notatkę: ${note.text}`}
            onClick={() => setDraft(note.text)}
            className="-mx-2 -my-1 rounded-md px-2 py-1 text-left break-words whitespace-pre-wrap outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {note.text}
          </button>
        ) : (
          note.text && <p className="break-words whitespace-pre-wrap">{note.text}</p>
        )}
        {editing ? (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)} className={EDIT_BUTTON}>
              Anuluj
            </Button>
            <Button size="sm" onClick={save} className={EDIT_BUTTON}>
              Zapisz
            </Button>
          </div>
        ) : hasMeta && (
          <div className="flex flex-wrap items-center gap-2.5">
            {note.attachments.map((a) => (
              <AttachmentChip key={a.id} attachment={a} />
            ))}
            <EntryStatus note={note} routeLabels={routeLabels} />
          </div>
        )}
      </div>
    </li>
  )
}
