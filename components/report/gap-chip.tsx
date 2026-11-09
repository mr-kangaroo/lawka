'use client'

import { cn } from 'cn'
import { XIcon } from 'lucide-react'
import { useId, useState } from 'react'
import { submitFromReport } from './report-note'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { DerivedGap } from '@/lib/report/gaps'
import { useShift } from '@/store/shift'

const CHIP = 'inline-flex h-[26px] items-center rounded-md border text-xs'
const TONE = {
  required: 'border-required-border bg-required-bg font-medium text-required',
  optional: 'border-dashed border-foreground/25 text-muted-foreground',
}

/**
 * A question gap (spec §4.6). Required: amber fill. Optional: dashed and muted, with × to
 * dismiss. Clicking opens a one-line answer, pre-filled with the AI's suggestion; saving files
 * it as a note answering the gap. Read-only: required chips stay as static labels, marked
 * "— brak danych"; optional ones are hidden.
 */
export function GapChip({ gap, readOnly }: { gap: DerivedGap; readOnly: boolean }) {
  const dismissGap = useShift((s) => s.dismissGap)
  const [open, setOpen] = useState(false)
  const tone = TONE[gap.weight]

  if (readOnly) {
    return gap.weight === 'required' ? (
      <span className={cn(CHIP, tone, 'px-2')}>{gap.question} — brak danych</span>
    ) : null
  }

  return (
    <span className={cn(CHIP, tone)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'relative h-full rounded-[5px] px-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 max-sm:before:absolute max-sm:before:inset-x-0 max-sm:before:-inset-y-2.5',
              gap.weight === 'optional' && 'pr-1.5 hover:text-foreground',
            )}
          >
            {gap.question}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" collisionPadding={12} className="w-80 max-w-[calc(100vw-2rem)]">
          <GapAnswer gap={gap} onDone={() => setOpen(false)} />
        </PopoverContent>
      </Popover>
      {gap.weight === 'optional' && (
        <button
          type="button"
          onClick={() => dismissGap(gap.id)}
          aria-label={`Pomiń pytanie: ${gap.question}`}
          className="relative mr-1.5 grid size-4 place-items-center rounded-sm text-muted-foreground outline-none before:absolute before:-inset-1 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 max-sm:before:-inset-y-3.5 max-sm:before:-right-3.5 max-sm:before:left-0"
        >
          <XIcon className="size-3" aria-hidden />
        </button>
      )}
    </span>
  )
}

function GapAnswer({ gap, onDone }: { gap: DerivedGap; onDone(): void }) {
  const [answer, setAnswer] = useState(gap.suggestion?.value ?? '')
  const inputId = useId()

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        const text = answer.trim()
        if (!text) return
        submitFromReport(text, [], { answersGapId: gap.id })
        onDone()
      }}
    >
      <label htmlFor={inputId} className="text-[13px] font-medium text-foreground">
        {gap.question}
      </label>
      <div className="flex items-center gap-2">
        <Input
          id={inputId}
          autoFocus
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Odpowiedź"
          autoComplete="off"
          className="h-8"
        />
        <Button type="submit" size="sm" className="h-8" disabled={!answer.trim()}>
          Zapisz
        </Button>
      </div>
    </form>
  )
}
