'use client'

import { useEffect, useMemo, useRef } from 'react'
import { NotebookPenIcon } from 'lucide-react'
import { routeLabel } from '@/lib/report/operations'
import { useShift } from '@/store/shift'
import { isAwaitingAnswer } from './ai-question-card'
import { JournalEntry } from './journal-entry'

/** Shown in the centre of an empty journal (a new shift). */
function EmptyJournal() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
      <span aria-hidden className="mb-4 grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <NotebookPenIcon className="size-5" />
      </span>
      <h2 className="text-lg font-semibold text-foreground">Zapisuj, co dzieje się na zmianie</h2>
      <p className="mt-1.5 max-w-[420px] text-sm leading-relaxed text-muted-foreground">
        Pisz krótko, jak na czacie: godzina, co się stało i gdzie. AI na bieżąco ułoży z tego raport, a gdy
        czegoś zabraknie, dopyta.
      </p>
    </div>
  )
}

/** The Dziennik tab: the shift's notes, oldest first, scrolled to the newest. */
export function Journal() {
  const shift = useShift((s) => s.shift)
  const listRef = useRef<HTMLOListElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const waitingNoteIds = useMemo(
    () => new Set(shift.sentAt ? [] : shift.questions.filter((q) => isAwaitingAnswer(shift, q)).map((q) => q.noteId)),
    [shift],
  )
  const routeLabels = useMemo(
    () =>
      new Map(
        shift.notes.map((n) => [n.id, n.routedTo.map((t) => routeLabel(shift, t)).filter((l): l is string => l !== null)]),
      ),
    [shift],
  )

  const empty = shift.notes.length === 0

  // A new note always scrolls to the end.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [shift.notes.length])

  // Stay pinned to the end while the user is there and the list or the viewport changes size
  // (a status line appears, the question card or the phone confirmation opens or closes).
  useEffect(() => {
    const scroller = endRef.current?.closest<HTMLElement>('[data-scroll-container]')
    if (!scroller || !listRef.current) return
    let atEnd = true
    const onScroll = () => {
      atEnd = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 48
    }
    const observer = new ResizeObserver(() => {
      if (atEnd) endRef.current?.scrollIntoView({ block: 'end' })
    })
    observer.observe(scroller)
    observer.observe(listRef.current)
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      observer.disconnect()
      scroller.removeEventListener('scroll', onScroll)
    }
    // Re-attach when the list first mounts (an empty journal renders no list).
  }, [empty])

  if (empty) return <EmptyJournal />

  return (
    <div className="mx-auto w-full max-w-[720px]">
      <ol ref={listRef}>
        {shift.notes.map((note) => (
          <JournalEntry
            key={note.id}
            note={note}
            waiting={waitingNoteIds.has(note.id)}
            routeLabels={routeLabels.get(note.id) ?? []}
          />
        ))}
      </ol>
      <div ref={endRef} />
    </div>
  )
}
