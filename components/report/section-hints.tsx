'use client'

import { cn } from 'cn'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { HINT_LABEL_OVERRIDES, HINT_ORDER, SECTION_LABELS } from '@/lib/report/catalog'
import type { SectionKey } from '@/lib/report/types'
import { useShift } from '@/store/shift'

const VISIBLE = 5

/** 28 px visually; on phones a 44 px hit area. */
const CHIP =
  'relative h-7 px-2.5 text-[13px] font-normal max-sm:before:absolute max-sm:before:inset-x-0 max-sm:before:-inset-y-2'

/**
 * "Często w raportach:" plus dashed chips for the conditional sections not yet in the report,
 * in `HINT_ORDER`. The first five are shown; "+ N więcej" reveals the rest. Hints, never gaps.
 */
export function SectionHints({ onAdd, className }: { onAdd(key: SectionKey): void; className?: string }) {
  const sections = useShift((s) => s.shift.sections)
  const [expanded, setExpanded] = useState(false)

  const missing = HINT_ORDER.filter((k) => !sections[k])
  if (missing.length === 0) return null
  const shown = expanded ? missing : missing.slice(0, VISIBLE)
  const more = missing.length - shown.length

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className="mr-1 text-[13px] text-muted-foreground">Często w raportach:</span>
      {shown.map((key) => (
        <Button
          key={key}
          variant="ghost"
          onClick={() => onAdd(key)}
          className={cn(CHIP, 'rounded-full border-dashed border-foreground/20 text-foreground/80')}
        >
          + {HINT_LABEL_OVERRIDES[key] ?? SECTION_LABELS[key]}
        </Button>
      ))}
      {more > 0 && (
        <Button variant="ghost" onClick={() => setExpanded(true)} className={cn(CHIP, 'px-2 text-muted-foreground')}>
          + {more} więcej
        </Button>
      )}
    </div>
  )
}
