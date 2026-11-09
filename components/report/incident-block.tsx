'use client'

import { cn } from 'cn'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { AttachmentChip } from '@/components/journal/attachment-chip'
import type { DerivedGap } from '@/lib/report/gaps'
import { emptyDoc, isDocEmpty } from '@/lib/report/rich'
import { formatHHMM } from '@/lib/report/time'
import type { Incident } from '@/lib/report/types'
import { useShift } from '@/store/shift'
import { GapChip } from './gap-chip'
import { IncidentMenu, toastRemoved } from './incident-menu'
import { InlineField } from './inline-field'
import { PlacePicker } from './place-picker'
import { RichEditor } from './rich-editor'
import { TimePicker } from './time-picker'
import { TypePicker } from './type-picker'

/** Stable empty doc for incidents without a description, so the editor prop stays the same. */
const EMPTY = emptyDoc()

type HeaderField = 'type' | 'time' | 'location'

/** Tooltip for an estimated time; impersonal on purpose (Polish 2nd-person past tense is gendered). */
export function approxTimeTooltip(sourcePhrase?: string): string {
  const ask = 'Sprecyzuj, jaka była dokładna godzina zdarzenia.'
  return sourcePhrase ? `W notatce: „${sourcePhrase}”. ${ask}` : ask
}

export type IncidentBlockProps = {
  incident: Incident
  /** Display number (#N), following the order on screen. */
  number: number
  /** Shift start, HH:MM: the time list starts there. */
  startHHMM: string
  /** Field gaps (missing or estimated values), shown on the fields themselves. */
  fieldGaps: Partial<Record<HeaderField, DerivedGap>>
  /** AI question gaps for this incident without a field, shown as chips. */
  chips: DerivedGap[]
  readOnly: boolean
  /** An incident just added by hand: scroll to it and open its type picker. */
  autoFocus?: boolean
  /** Called once `autoFocus` has been applied on mount. */
  onAutoFocused?(): void
}

/**
 * One incident: a sentence-like header (#N type · time · place, each an inline picker), the
 * "dodano o" / ⋯ menu, the rich-text description, attachments and question chips (spec §4.4).
 */
export function IncidentBlock({
  incident,
  number,
  startHHMM,
  fieldGaps,
  chips,
  readOnly,
  autoFocus,
  onAutoFocused,
}: IncidentBlockProps) {
  const setIncidentField = useShift((s) => s.setIncidentField)
  const setIncidentDescription = useShift((s) => s.setIncidentDescription)
  const confirmIncident = useShift((s) => s.confirmIncident)
  const removeIncident = useShift((s) => s.removeIncident)
  const undoRemove = useShift((s) => s.undoRemove)
  const suspected = !!incident.suspected
  // An incident added by hand starts with its type picker open (focus goes to its search).
  const [open, setOpen] = useState<HeaderField | null>(autoFocus ? 'type' : null)
  const rootRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!autoFocus) return
    rootRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    onAutoFocused?.()
    // Only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openProps = (field: HeaderField) => ({
    open: open === field,
    onOpenChange: (o: boolean) => setOpen(o ? field : null),
  })
  const save = (field: HeaderField, value: Parameters<typeof setIncidentField>[2]) => {
    setIncidentField(incident.id, field, value)
    setOpen(null)
  }

  const type = incident.type?.value ?? null
  const time = incident.time?.value ?? null
  const location = incident.location?.value ?? null
  const description = incident.description ?? EMPTY
  const descriptionMissing = isDocEmpty(description)

  const timeLabel = !time
    ? 'Godzina zdarzenia: brak'
    : time.approx
      ? `Godzina zdarzenia: około ${time.hhmm}, do doprecyzowania`
      : `Godzina zdarzenia: ${time.hhmm}`
  const timeTooltip = time?.approx ? approxTimeTooltip(time.sourcePhrase) : fieldGaps.time?.question

  const footer = incident.attachments.length > 0 || chips.some((g) => !readOnly || g.weight === 'required')

  return (
    <section
      ref={rootRef}
      id={`incident-${incident.id}`}
      aria-label={`${suspected ? 'Możliwy incydent' : 'Incydent'} #${number}`}
      className={cn(
        'group/incident flex scroll-mt-6 flex-col gap-1.5 rounded-[10px] border bg-card/40 px-3.5 py-3 text-sm leading-[1.55]',
        suspected && 'border-dashed border-required-border',
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={cn('mr-0.5 font-semibold', suspected ? 'text-required' : 'text-foreground')}>
          #{number}
        </span>
        <InlineField
          label={`Typ zdarzenia: ${type ?? 'brak'}`}
          value={type}
          placeholder="typ"
          bold
          tooltip={fieldGaps.type?.question}
          readOnly={readOnly}
          {...openProps('type')}
        >
          <TypePicker value={type} onSelect={(v) => save('type', v)} />
        </InlineField>
        <Dot />
        <InlineField
          label={timeLabel}
          value={
            !time || (readOnly && time.approx) // Sent with an unresolved estimate: "brak danych".
              ? null
              : (time.approx ? (
              <>
                <span aria-hidden className="mr-[3px] font-semibold">
                  ?
                </span>
                {time.hhmm}
              </>
            ) : (
              time.hhmm
            ))
          }
          placeholder="00:00"
          placeholderAsValue
          required={time?.approx}
          tooltip={readOnly && time?.approx ? undefined : timeTooltip}
          readOnly={readOnly}
          contentClassName="w-56"
          {...openProps('time')}
        >
          <TimePicker
            value={time}
            hint={time?.approx ? approxTimeTooltip(time.sourcePhrase) : undefined}
            startHHMM={startHHMM} onSave={(hhmm) => save('time', { hhmm, approx: false })}
          />
        </InlineField>
        <Dot />
        <InlineField
          label={`Miejsce: ${location ?? 'brak'}`}
          value={location}
          placeholder="miejsce"
          tooltip={fieldGaps.location?.question}
          readOnly={readOnly}
          {...openProps('location')}
        >
          <PlacePicker value={location} onSelect={(v) => save('location', v)} />
        </InlineField>
        <div className="ml-auto pl-2">
          {readOnly ? (
            <span className="text-xs text-muted-foreground">dodano o {formatHHMM(incident.createdAt)}</span>
          ) : (
            <IncidentMenu incidentId={incident.id} number={number} addedAt={formatHHMM(incident.createdAt)} />
          )}
        </div>
      </div>

      <div className="text-[15px] leading-[1.65] text-foreground/90">
        {readOnly && descriptionMissing ? (
          <p className="text-required">brak danych</p>
        ) : (
          <RichEditor
            doc={description}
            onChange={(d) => setIncidentDescription(incident.id, d)}
            editable={!readOnly}
            placeholder="Opis zdarzenia"
            ariaLabel={`Opis incydentu #${number}`}
            // Missing description is a field gap: amber placeholder (the global rule is unlayered).
            className="[&_p.is-editor-empty:first-child]:before:text-required!"
          />
        )}
      </div>

      {suspected && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-1">
          <span className="text-[13px] text-required">
            {readOnly ? 'Niepotwierdzony incydent' : 'Czy to był incydent?'}
          </span>
          {!readOnly && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                data-gap-focus="suspected"
                onClick={() => confirmIncident(incident.id)}
                className="relative h-7 border-required-border px-2.5 text-[13px] text-required hover:text-required max-sm:before:absolute max-sm:before:inset-x-0 max-sm:before:-inset-y-2"
              >
                Tak, to incydent
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  removeIncident(incident.id)
                  toastRemoved(undoRemove)
                }}
                className="relative h-7 px-2.5 text-[13px] text-muted-foreground max-sm:before:absolute max-sm:before:inset-x-0 max-sm:before:-inset-y-2"
              >
                Nie, usuń
              </Button>
            </div>
          )}
        </div>
      )}

      {footer && (
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          {incident.attachments.map((a) => (
            <AttachmentChip key={a.id} attachment={a} />
          ))}
          {chips.map((g) => (
            <GapChip key={g.id} gap={g} readOnly={readOnly} />
          ))}
        </div>
      )}
    </section>
  )
}

function Dot() {
  return (
    <span aria-hidden className="text-muted-foreground/70">
      ·
    </span>
  )
}
