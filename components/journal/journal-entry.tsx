'use client'

import { LoaderCircleIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatHHMM } from '@/lib/report/time'
import type { Note } from '@/lib/report/types'
import { useShift } from '@/store/shift'
import { AttachmentChip } from './attachment-chip'

function EntryStatus({ note, waiting, routeLabels }: EntryProps) {
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
    return <span className="text-[13px] text-muted-foreground">→ {routeLabels.join(' · ')}</span>
  return null
}

export type EntryProps = {
  note: Note
  /** An open AI question about this note is awaiting an answer. */
  waiting: boolean
  /** Current labels of `note.routedTo` (see `routeLabel`), removed incidents already skipped. */
  routeLabels: string[]
}

/** One journal note: time column, text, attachment chips and the status line (spec §4.2). */
export function JournalEntry({ note, waiting, routeLabels }: EntryProps) {
  const hasMeta = note.attachments.length > 0 || waiting || note.status !== 'processed' || routeLabels.length > 0
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
            <EntryStatus note={note} waiting={waiting} routeLabels={routeLabels} />
          </div>
        )}
      </div>
    </li>
  )
}
