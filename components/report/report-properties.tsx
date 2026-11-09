'use client'

import { CalendarIcon, ChevronDownIcon, UserIcon } from 'lucide-react'
import { useState } from 'react'
import { pl } from 'react-day-picker/locale'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { PEOPLE } from '@/lib/report/people'
import type { Person } from '@/lib/report/types'
import { useShift } from '@/store/shift'

/** `YYYY-MM-DD` → local midnight (never UTC). */
export function parseLocalDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Local date → `YYYY-MM-DD` (never `toISOString`, which shifts to UTC). */
export function toLocalDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const part = (d: Date, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('pl-PL', opts).format(d).replace(/\.$/, '')

/** "niedz, 8 lis 2026" and "pon, 9 lis": the shift start and the next day (shifts cross midnight). */
export function shiftDateLabel(date: string): { start: string; end: string } {
  const start = parseLocalDate(date)
  const next = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1)
  const day = (d: Date) => `${part(d, { weekday: 'short' })}, ${d.getDate()} ${part(d, { month: 'short' })}`
  return { start: `${day(start)} ${start.getFullYear()}`, end: day(next) }
}

/** Avatar colours per person tone (static strings so Tailwind sees them). */
const TONES: Record<Person['tone'], string> = {
  blue: 'bg-slate-800 text-blue-300',
  teal: 'bg-teal-900 text-teal-300',
  purple: 'bg-purple-950 text-purple-300',
  pink: 'bg-pink-950 text-pink-300',
}

function Initials({ person, className }: { person: Person; className?: string }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full font-semibold ${TONES[person.tone]} ${className ?? ''}`}
    >
      {person.initials}
    </span>
  )
}

/** Borderless value control that highlights on hover; 44 px hit area on phones. */
const VALUE =
  'relative h-8 rounded-md px-2 text-sm font-normal text-foreground disabled:opacity-100 max-sm:before:absolute max-sm:before:inset-x-0 max-sm:before:-inset-y-1.5'

function DateProperty({ readOnly }: { readOnly: boolean }) {
  const date = useShift((s) => s.shift.date)
  const setDate = useShift((s) => s.setDate)
  const [open, setOpen] = useState(false)
  const { start, end } = shiftDateLabel(date)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" disabled={readOnly} aria-labelledby="prop-date prop-date-value" className={VALUE}>
          <span id="prop-date-value">
            {start}{' '}
            <span className="ml-0.5 text-muted-foreground">→ {end}</span>
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          locale={pl}
          selected={parseLocalDate(date)}
          defaultMonth={parseLocalDate(date)}
          onSelect={(d) => {
            if (!d) return
            setDate(toLocalDate(d))
            setOpen(false)
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}

function AuthorProperty({ readOnly }: { readOnly: boolean }) {
  const authorId = useShift((s) => s.shift.authorId)
  const setAuthor = useShift((s) => s.setAuthor)
  const author = PEOPLE.find((p) => p.id === authorId) ?? PEOPLE[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          disabled={readOnly}
          aria-labelledby="prop-author prop-author-value"
          className={`${VALUE} group gap-2 pl-1`}
        >
          <Initials person={author} className="size-[22px] text-[10px]" />
          <span id="prop-author-value">{author.name}</span>
          <ChevronDownIcon className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-aria-expanded:opacity-100" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[280px]" aria-label="Autor raportu">
        <DropdownMenuRadioGroup value={author.id} onValueChange={setAuthor}>
          {PEOPLE.map((p) => (
            <DropdownMenuRadioItem key={p.id} value={p.id} className="gap-2.5 py-2 pl-2">
              <Initials person={p} className="size-7 text-[11px]" />
              <span className="flex flex-col leading-tight">
                {p.name}
                <span className="text-xs text-muted-foreground">{p.role}</span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const ROW = 'flex min-h-[34px] items-center gap-2'
const LABEL = 'flex w-[124px] flex-none items-center gap-2 text-muted-foreground sm:w-[140px] [&_svg]:size-4'

/** Notion-style properties under the title (spec §4.3). */
export function ReportProperties({ readOnly }: { readOnly: boolean }) {
  return (
    <dl className="flex flex-col gap-0.5 text-sm">
      <div className={ROW}>
        <dt id="prop-date" className={LABEL}>
          <CalendarIcon aria-hidden />
          Data zmiany
        </dt>
        <dd className="min-w-0 flex-1">
          <DateProperty readOnly={readOnly} />
        </dd>
      </div>
      <div className={ROW}>
        <dt id="prop-author" className={LABEL}>
          <UserIcon aria-hidden />
          Autor
        </dt>
        <dd className="min-w-0 flex-1">
          <AuthorProperty readOnly={readOnly} />
        </dd>
      </div>
    </dl>
  )
}
