'use client'

import { cn } from 'cn'
import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { EventTime } from '@/lib/report/types'
import { parseHHMM, timeSlots } from '@/lib/report/time'

const ERROR = 'Podaj godzinę, np. 01:05'

/**
 * Event time picker: an exact time typed into the field (validated with `parseHHMM`) or a
 * 5-minute slot from the list, which starts at the shift start and wraps past midnight.
 */
export function TimePicker({
  value,
  hint,
  startHHMM,
  onSave,
}: {
  value: EventTime | null
  /** Muted helper text at the top (for an estimated time; tooltips don't open on touch). */
  hint?: string
  startHHMM: string
  onSave(hhmm: string): void
}) {
  const [text, setText] = useState(value?.hhmm ?? '')
  const [invalid, setInvalid] = useState(false)
  const slots = useMemo(() => timeSlots(startHHMM), [startHHMM])
  const listRef = useRef<HTMLUListElement>(null)
  const errorId = useId()

  // Scroll the list so the current value (or the slot it falls in) is in the middle.
  const anchor = useMemo(() => {
    if (!value) return null
    const [h, m] = value.hhmm.split(':').map(Number)
    return `${String(h).padStart(2, '0')}:${String(m - (m % 5)).padStart(2, '0')}`
  }, [value])
  useLayoutEffect(() => {
    const list = listRef.current
    const el = anchor ? list?.querySelector<HTMLElement>(`[data-slot-time="${anchor}"]`) : null
    if (list && el) list.scrollTop = el.offsetTop - list.clientHeight / 2 + el.offsetHeight / 2
  }, [anchor])

  return (
    <div className="flex flex-col">
      {hint && <p className="border-b px-3 py-2 text-xs leading-snug text-muted-foreground">{hint}</p>}
      <form
        className="flex items-center gap-2 border-b p-2"
        onSubmit={(e) => {
          e.preventDefault()
          const hhmm = parseHHMM(text)
          if (hhmm) onSave(hhmm)
          else setInvalid(true)
        }}
      >
        <Input
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setInvalid(false)
          }}
          placeholder="np. 01:05"
          aria-label="Godzina zdarzenia"
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          autoComplete="off"
          className="h-8 tabular-nums"
        />
        <Button type="submit" size="sm" className="h-8">
          Zapisz
        </Button>
      </form>
      {invalid && (
        <p id={errorId} role="alert" className="px-3 pt-2 text-xs text-destructive">
          {ERROR}
        </p>
      )}
      <ul ref={listRef} aria-label="Godziny co 5 minut" className="relative max-h-56 overflow-y-auto p-1">
        {slots.map((s) => {
          const current = s === value?.hhmm
          return (
            <li key={s}>
              <button
                type="button"
                data-slot-time={s}
                aria-current={current || undefined}
                onClick={() => onSave(s)}
                className={cn(
                  'flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm tabular-nums outline-none hover:bg-muted focus-visible:bg-muted',
                  current && 'bg-muted font-medium text-foreground',
                )}
              >
                {s}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
