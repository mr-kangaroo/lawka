'use client'

import { Button } from '@/components/ui/button'
import { formatHHMM } from '@/lib/report/time'
import { useShift } from '@/store/shift'

/** Top of the sent report: "Wysłano HH:MM" and "Nowa zmiana". Renders nothing before sending. */
export function SentBanner() {
  const sentAt = useShift((s) => s.shift.sentAt)
  const newShift = useShift((s) => s.newShift)
  if (!sentAt) return null
  return (
    <div
      role="status"
      className="mb-5 flex items-center justify-between gap-3 rounded-[10px] border bg-card/60 px-3.5 py-2.5 text-sm"
    >
      <span className="text-foreground">Wysłano {formatHHMM(sentAt)}</span>
      <Button variant="outline" size="sm" onClick={newShift} className="relative h-8 max-sm:before:absolute max-sm:before:inset-x-0 max-sm:before:-inset-y-1.5">
        Nowa zmiana
      </Button>
    </div>
  )
}
