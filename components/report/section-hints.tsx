'use client'

import { cn } from 'cn'
import { useLayoutEffect, useRef, useState, type ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import { HINT_LABEL_OVERRIDES, HINT_ORDER, SECTION_LABELS } from '@/lib/report/catalog'
import type { SectionKey } from '@/lib/report/types'
import { useShift } from '@/store/shift'

/** 28 px visually; on phones a 44 px hit area. */
const CHIP =
  'relative h-7 shrink-0 px-2.5 text-[13px] font-normal max-sm:before:absolute max-sm:before:inset-x-0 max-sm:before:-inset-y-2'
const GAP = 8 // gap-2

/**
 * "Dodaj do raportu" and, on the line below, dashed chips for the conditional sections not yet in
 * the report, in `HINT_ORDER`. Collapsed, the chips fill at most one row of the container and the
 * rest hide behind "+ N więcej", which reveals them all. Hints, never gaps.
 */
export function SectionHints({ onAdd, className }: { onAdd(key: SectionKey): void; className?: string }) {
  const sections = useShift((s) => s.shift.sections)
  const [expanded, setExpanded] = useState(false)
  const [visible, setVisible] = useState<number | null>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)

  const missing = HINT_ORDER.filter((k) => !sections[k])
  const missingKey = missing.join(',')

  // Count how many chips fit in one row, leaving room for "+ N więcej" when some don't.
  useLayoutEffect(() => {
    const row = rowRef.current
    const measure = measureRef.current
    if (!row || !measure) return
    const fit = () => {
      const width = row.clientWidth
      const chips = [...measure.querySelectorAll<HTMLElement>('[data-chip]')].map((el) => el.offsetWidth)
      const more = measure.querySelector<HTMLElement>('[data-more]')?.offsetWidth ?? 0
      const total = chips.reduce((sum, w, i) => sum + w + (i ? GAP : 0), 0)
      if (total <= width) return setVisible(chips.length)
      let used = more
      let n = 0
      while (n < chips.length && used + GAP + chips[n] <= width) used += GAP + chips[n++]
      setVisible(n)
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(row)
    return () => observer.disconnect()
  }, [missingKey])

  if (missing.length === 0) return null
  const count = expanded || visible === null ? missing.length : visible
  const shown = missing.slice(0, count)
  const more = missing.length - shown.length

  const chip = (key: SectionKey, props: ComponentProps<typeof Button> = {}) => (
    <Button
      key={key}
      variant="ghost"
      className={cn(CHIP, 'rounded-full border-dashed border-foreground/20 text-foreground/80')}
      {...props}
    >
      + {HINT_LABEL_OVERRIDES[key] ?? SECTION_LABELS[key]}
    </Button>
  )

  return (
    <div className={cn('relative flex flex-col gap-2', className)}>
      <span className="text-[13px] text-muted-foreground">Dodaj do raportu</span>
      <div ref={rowRef} className={cn('flex items-center gap-2', expanded ? 'flex-wrap' : 'overflow-hidden')}>
        {shown.map((key) => chip(key, { onClick: () => onAdd(key) }))}
        {more > 0 && (
          <Button variant="ghost" onClick={() => setExpanded(true)} className={cn(CHIP, 'px-2 text-muted-foreground')}>
            + {more} więcej
          </Button>
        )}
      </div>
      {/* Off-screen copy of every chip, measured to decide how many fit. */}
      <div aria-hidden inert className="pointer-events-none absolute inset-x-0 top-0 h-0 overflow-hidden">
        <div ref={measureRef} className="invisible flex w-max gap-2">
          {missing.map((key) => (
            <span key={key} data-chip className="flex">
              {chip(key, { tabIndex: -1 })}
            </span>
          ))}
          <span data-more className="flex">
            <Button variant="ghost" tabIndex={-1} className={cn(CHIP, 'px-2')}>
              + {missing.length} więcej
            </Button>
          </span>
        </div>
      </div>
    </div>
  )
}
