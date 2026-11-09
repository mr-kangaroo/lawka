'use client'

import { useEffect, useState } from 'react'
import { CheckIcon } from 'lucide-react'
import { routeLabel } from '@/lib/report/operations'
import { formatHHMM } from '@/lib/report/time'
import type { Note, Shift } from '@/lib/report/types'
import { useShift } from '@/store/shift'

const VISIBLE_MS = 4000

type Filed = { target: string; time: string }

/** "Incydent #1 · 22:40": an incident shows its event time, anything else the note's time. */
function filedAs(shift: Shift, note: Note): Filed | null {
  const route = note.routedTo.find((t) => routeLabel(shift, t) !== null)
  if (!route) return null
  const incident = route.kind === 'incident' ? shift.incidents.find((i) => i.id === route.incidentId) : undefined
  return { target: routeLabel(shift, route)!, time: incident?.time?.value.hhmm ?? formatHHMM(note.createdAt) }
}

/** Phone-only confirmation above the input after a note is filed (spec §4.1). */
export function FiledConfirmation() {
  const [filed, setFiled] = useState<Filed | null>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsubscribe = useShift.subscribe((state, prev) => {
      if (state.shift === prev.shift) return
      const before = new Map(prev.shift.notes.map((n) => [n.id, n.status]))
      const note = state.shift.notes.findLast(
        (n) => n.status === 'processed' && n.routedTo.length > 0 && before.get(n.id) === 'pending',
      )
      const next = note && filedAs(state.shift, note)
      if (!next) return
      setFiled(next)
      clearTimeout(timer)
      timer = setTimeout(() => setFiled(null), VISIBLE_MS)
    })
    return () => {
      unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  if (!filed) return null
  return (
    <div
      role="status"
      className="flex items-center gap-2.5 rounded-xl border border-border bg-card/60 px-3 py-2.5 text-sm sm:hidden"
    >
      <CheckIcon className="size-[18px] text-emerald-400" aria-hidden />
      <span>
        Zapisano jako <strong className="font-semibold">{filed.target} · {filed.time}</strong>
      </span>
    </div>
  )
}
