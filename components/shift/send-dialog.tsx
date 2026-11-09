'use client'

import { useMemo, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { jumpTargetFor } from '@/lib/report/gap-target'
import { openGaps, type DerivedGap } from '@/lib/report/gaps'
import { useShift } from '@/store/shift'

/** Scrolls to the gap's place in the Raport tab and focuses it. Retries while the tab mounts. */
function jumpTo(gap: DerivedGap) {
  const { elementId, focus } = jumpTargetFor(gap.target)
  let tries = 0
  const run = () => {
    const el = document.getElementById(elementId)
    if (!el) {
      if (tries++ < 10) requestAnimationFrame(run)
      return
    }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    const target = (focus ? el.querySelector<HTMLElement>(focus) : null) ?? el
    if (target === el && !el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1')
    target.focus({ preventScroll: true })
  }
  requestAnimationFrame(run)
}

/**
 * The review dialog behind "Wyślij raport" (spec §4.7): either "Raport kompletny. Wysłać?" or
 * the list of required gaps, each jumping to its place, with [Uzupełnij] and [Wyślij mimo to].
 */
export function SendDialog({ open, onOpenChange }: { open: boolean; onOpenChange(open: boolean): void }) {
  const shift = useShift((s) => s.shift)
  const send = useShift((s) => s.send)
  const setTab = useShift((s) => s.setTab)
  const required = useMemo(() => openGaps(shift).filter((g) => g.weight === 'required'), [shift])
  // Set when closing to jump; applied in `onCloseAutoFocus` so the dialog doesn't steal focus back.
  const pending = useRef<DerivedGap | null>(null)

  const complete = required.length === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={(e) => {
          if (!pending.current) return
          e.preventDefault()
          const gap = pending.current
          pending.current = null
          setTab('report')
          jumpTo(gap)
        }}
      >
        <DialogHeader>
          <DialogTitle>{complete ? 'Raport kompletny. Wysłać?' : 'Do uzupełnienia przed wysłaniem'}</DialogTitle>
          <DialogDescription>
            {complete
              ? 'Wszystkie wymagane informacje są uzupełnione. Po wysłaniu raportu nie będzie można już edytować.'
              : 'Tych informacji wciąż brakuje. Jeśli wyślesz teraz, w raporcie pojawią się jako „brak danych”, a raportu nie będzie można już edytować.'}
          </DialogDescription>
        </DialogHeader>
        {!complete && (
          <ul className="-mx-1 flex flex-col">
            {required.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => {
                    pending.current = g
                    onOpenChange(false)
                  }}
                  className="flex min-h-11 w-full items-center rounded-md px-2 py-1.5 text-left text-[13px] text-required outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {g.question}
                </button>
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          {complete ? (
            <Button
              onClick={() => {
                send()
                onOpenChange(false)
              }}
            >
              Wyślij
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  send()
                  onOpenChange(false)
                }}
              >
                Wyślij mimo to
              </Button>
              <Button autoFocus onClick={() => onOpenChange(false)}>
                Uzupełnij
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
