'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { VENUE_AREAS } from '@/lib/report/catalog'
import { matches } from '@/lib/report/search'
import { MatchLabel } from './type-picker'

const OTHER = '__other-place__'

/** Place picker: the venue's areas (searchable) plus "Inne…", which switches to free text. */
export function PlacePicker({ value, onSelect }: { value: string | null; onSelect(place: string): void }) {
  const [query, setQuery] = useState('')
  // Free-text mode ("Inne…"): the text being typed; null while the list is shown.
  const [custom, setCustom] = useState<string | null>(null)
  const q = query.trim()
  const items = VENUE_AREAS.filter((a) => matches(q, a))

  if (custom !== null) {
    return (
      <form
        className="flex items-center gap-2 p-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (custom.trim()) onSelect(custom.trim())
        }}
      >
        <Input
          autoFocus
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Wpisz miejsce"
          aria-label="Miejsce (własne)"
          autoComplete="off"
          className="h-8"
        />
        <Button type="submit" size="sm" className="h-8" disabled={!custom.trim()}>
          Zapisz
        </Button>
      </form>
    )
  }

  const valueIsCustom = value !== null && !VENUE_AREAS.includes(value)

  return (
    <Command shouldFilter={false} label="Wybierz miejsce" className="rounded-lg!">
      <CommandInput value={query} onValueChange={setQuery} placeholder="Szukaj miejsca" aria-label="Szukaj miejsca" />
      <CommandList className="max-h-64 pt-1">
        {items.length > 0 && (
          <CommandGroup className="p-0">
            {items.map((a) => (
              <CommandItem key={a} value={a} data-checked={a === value} onSelect={() => onSelect(a)}>
                <MatchLabel query={q} label={a} />
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {items.length > 0 && <CommandSeparator alwaysRender className="mx-0 my-1" />}
        <CommandGroup className="p-0">
          <CommandItem
            value={OTHER}
            data-checked={valueIsCustom}
            onSelect={() => setCustom(q || (valueIsCustom ? value : ''))}
            className="text-foreground/80"
          >
            <span className="min-w-0 flex-1 truncate">Inne…</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  )
}
