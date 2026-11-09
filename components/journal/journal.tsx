'use client'

import { useEffect, useMemo, useRef } from 'react'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { routeLabel } from '@/lib/report/operations'
import { PEOPLE } from '@/lib/report/people'
import { useShift } from '@/store/shift'
import { isAwaitingAnswer } from './ai-question-card'
import { JournalEntry } from './journal-entry'

const WEEKDAYS = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So']

/** "Nd, 8 listopada" from a YYYY-MM-DD shift date, read as a local date. */
function shiftDateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const local = new Date(y, m - 1, d)
  return `${WEEKDAYS[local.getDay()]}, ${format(local, 'd MMMM', { locale: pl })}`
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
  const author = PEOPLE.find((p) => p.id === shift.authorId)

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
  }, [])

  return (
    <div className="mx-auto w-full max-w-[720px]">
      <p className="mb-1 text-[13px] text-muted-foreground">
        {shiftDateLabel(shift.date)}
        {author && ` · ${author.name}`}
      </p>
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
