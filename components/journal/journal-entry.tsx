'use client'

import { LoaderCircleIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatHHMM } from '@/lib/report/time'
import type { Note } from '@/lib/report/types'
import { useShift } from '@/store/shift'
import { AttachmentChip } from './attachment-chip'

function EntryStatus({ note, waiting }: { note: Note; waiting: boolean }) {
  const retryNote = useShift((s) => s.retryNote)

  if (waiting) return <span className="text-[13px] text-required">czeka na Twoją odpowiedź ↓</span>
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
        <Button variant="link" size="xs" className="h-auto px-0 text-[13px] text-foreground" onClick={() => void retryNote(note.id)}>
          Ponów
        </Button>
      </span>
    )
  if (note.routedTo.length > 0)
    return <span className="text-[13px] text-muted-foreground">→ {note.routedTo.join(' · ')}</span>
  return null
}

/** One journal note: time column, text, attachment chips and the status line (spec §4.2). */
export function JournalEntry({ note, waiting }: { note: Note; waiting: boolean }) {
  const hasMeta = note.attachments.length > 0 || waiting || note.status !== 'processed' || note.routedTo.length > 0
  return (
    <li className="grid grid-cols-[44px_minmax(0,1fr)] gap-3 border-b border-border/50 py-3 sm:grid-cols-[56px_minmax(0,1fr)]">
      <time dateTime={note.createdAt} className="pt-0.5 text-[13px] text-muted-foreground tabular-nums">
        {formatHHMM(note.createdAt)}
      </time>
      <div className="flex flex-col gap-1.5">
        {note.text && <p className="break-words whitespace-pre-wrap">{note.text}</p>}
        {hasMeta && (
          <div className="flex flex-wrap items-center gap-2.5">
            {note.attachments.map((a) => (
              <AttachmentChip key={a.id} attachment={a} />
            ))}
            <EntryStatus note={note} waiting={waiting} />
          </div>
        )}
      </div>
    </li>
  )
}
