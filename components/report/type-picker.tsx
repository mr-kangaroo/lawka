'use client'

import { useState } from 'react'
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { INCIDENT_TYPES } from '@/lib/report/catalog'
import { matches, normalizeForSearch, splitMatch } from '@/lib/report/search'

/** A label with the part matching `query` in bold (diacritics ignored: "boj" bolds "Bój"). */
export function MatchLabel({ query, label }: { query: string; label: string }) {
  return (
    <span className="min-w-0 flex-1 truncate">
      {splitMatch(query, label).map((p, i) =>
        p.match ? (
          <strong key={i} className="font-semibold text-foreground">
            {p.text}
          </strong>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </span>
  )
}

const CUSTOM = '__custom-type__'

/**
 * Incident type picker: a search field on top, the predefined types filtered with `matches`
 * (matches in bold) and, last, "+ Użyj „<query>” jako własnego typu".
 */
export function TypePicker({ value, onSelect }: { value: string | null; onSelect(type: string): void }) {
  const [query, setQuery] = useState('')
  const q = query.trim()
  const items = INCIDENT_TYPES.filter((t) => matches(q, t))
  const exact = INCIDENT_TYPES.some((t) => normalizeForSearch(t) === normalizeForSearch(q))
  const showCustom = q.length > 0 && !exact

  return (
    <Command shouldFilter={false} label="Wybierz typ zdarzenia" className="rounded-lg!">
      <CommandInput value={query} onValueChange={setQuery} placeholder="Szukaj typu" aria-label="Szukaj typu" />
      <CommandList className="max-h-64 pt-1">
        {items.length > 0 && (
          <CommandGroup className="p-0">
            {items.map((t) => (
              <CommandItem key={t} value={t} data-checked={t === value} onSelect={() => onSelect(t)}>
                <MatchLabel query={q} label={t} />
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {showCustom && (
          <>
            {items.length > 0 && <CommandSeparator alwaysRender className="mx-0 my-1" />}
            <CommandGroup className="p-0">
              <CommandItem value={CUSTOM} onSelect={() => onSelect(q)} className="text-foreground/80">
                <span className="min-w-0 flex-1 truncate">+ Użyj „{q}” jako własnego typu</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </Command>
  )
}
