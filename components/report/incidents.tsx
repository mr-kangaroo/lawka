'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { fieldGap, openGaps, type DerivedGap } from '@/lib/report/gaps'
import { sortIncidents } from '@/lib/report/operations'
import { formatHHMM } from '@/lib/report/time'
import { useShift } from '@/store/shift'
import { IncidentBlock } from './incident-block'

const HEADING_ID = 'incidents-label'

/**
 * The Incydenty part of the report (spec §4.4): the heading row with "+ Dodaj incydent", then
 * the incident blocks in time order, or the "Brak incydentów" confirmation when there are none.
 */
export function Incidents() {
  const shift = useShift((s) => s.shift)
  const addEmptyIncident = useShift((s) => s.addEmptyIncident)
  const confirmNoIncidents = useShift((s) => s.confirmNoIncidents)
  // The incident just added by hand; it opens its type picker when it mounts.
  const [added, setAdded] = useState<string | null>(null)

  const readOnly = !!shift.sentAt
  const incidents = useMemo(() => sortIncidents(shift), [shift])
  // AI question gaps targeting an incident without a field are chips; field gaps live on the fields.
  const chipsByIncident = useMemo(() => {
    const map = new Map<string, DerivedGap[]>()
    for (const g of openGaps(shift)) {
      if (g.origin !== 'ai' || g.target.kind !== 'incident' || g.target.field) continue
      const list = map.get(g.target.incidentId) ?? []
      list.push(g)
      map.set(g.target.incidentId, list)
    }
    return map
  }, [shift])
  const startHHMM = formatHHMM(shift.startedAt)

  let body
  if (incidents.length > 0) {
    body = (
      <div className="flex flex-col gap-2">
        {incidents.map((inc, i) => (
          <IncidentBlock
            key={inc.id}
            incident={inc}
            number={i + 1}
            startHHMM={startHHMM}
            fieldGaps={{
              type: fieldGap(shift, inc.id, 'type'),
              time: fieldGap(shift, inc.id, 'time'),
              location: fieldGap(shift, inc.id, 'location'),
            }}
            chips={chipsByIncident.get(inc.id) ?? []}
            readOnly={readOnly}
            autoFocus={inc.id === added}
          />
        ))}
      </div>
    )
  } else if (shift.noIncidentsConfirmed) {
    body = <p>Brak incydentów w trakcie zmiany.</p>
  } else {
    body = (
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <p className="text-muted-foreground">Nie zgłoszono żadnych incydentów.</p>
        {!readOnly && (
          <Button
            variant="ghost"
            size="sm"
            onClick={confirmNoIncidents}
            className="relative h-7 rounded-md border-required-border bg-required-bg px-2.5 text-[13px] font-medium text-required hover:border-required hover:bg-required-bg hover:text-required dark:hover:bg-required-bg max-sm:before:absolute max-sm:before:inset-x-0 max-sm:before:-inset-y-2"
          >
            Potwierdź: brak incydentów
          </Button>
        )}
      </div>
    )
  }

  return (
    <section id="incidents" aria-labelledby={HEADING_ID} className="mt-5 scroll-mt-6">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <h3 id={HEADING_ID} className="text-[15px] font-semibold text-foreground">
          Incydenty
        </h3>
        {!readOnly && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAdded(addEmptyIncident())}
            className="relative -my-1 h-7 px-2 text-[13px] font-normal text-muted-foreground max-sm:before:absolute max-sm:before:inset-x-0 max-sm:before:-inset-y-2"
          >
            + Dodaj incydent
          </Button>
        )}
      </div>
      {body}
    </section>
  )
}
