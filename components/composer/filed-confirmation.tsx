'use client'

import { useEffect, useState } from 'react'
import { CheckIcon } from 'lucide-react'
import { sortIncidents } from '@/lib/report/operations'
import { formatHHMM } from '@/lib/report/time'
import type { Note, Shift } from '@/lib/report/types'
import { useShift } from '@/store/shift'

const VISIBLE_MS = 4000

type Filed = { target: string; time: string }

/** "Incydent #1 · 22:40": an incident shows its event time, anything else the note's time. */
function filedAs(shift: Shift, note: Note): Filed {
  const target = note.routedTo[0]
  const match = /^Incydent #(\d+)$/.exec(target)
  const incident = match ? sortIncidents(shift)[Number(match[1]) - 1] : undefined
  return { target, time: incident?.time?.value.hhmm ?? formatHHMM(note.createdAt) }
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
      if (!note) return
      setFiled(filedAs(state.shift, note))
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
