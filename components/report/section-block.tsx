'use client'

import { cn } from 'cn'
import { CheckIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { EMPTY_SECTION_PROMPTS, FIXED_SECTIONS, SECTION_LABELS } from '@/lib/report/catalog'
import { sectionQuestionGaps } from '@/lib/report/gaps'
import { emptyDoc, isDocEmpty } from '@/lib/report/rich'
import type { SectionKey } from '@/lib/report/types'
import { useShift } from '@/store/shift'
import { AttachmentTiles } from './attachment-tiles'
import { GapChip } from './gap-chip'
import { RichEditor } from './rich-editor'

/** Stable empty doc for fixed sections that don't exist in the store yet. */
const EMPTY = emptyDoc()

export const SUMMARY_EMPTY_PROMPT = 'Podsumowanie pojawi się po pierwszych notatkach.'

const promptFor = (key: SectionKey) => (key === 'summary' ? SUMMARY_EMPTY_PROMPT : EMPTY_SECTION_PROMPTS[key])

/** Fixed sections 3–5 can be confirmed with "Bez uwag" while empty (spec §4.5). */
const canConfirm = (key: SectionKey) => key !== 'summary' && FIXED_SECTIONS.includes(key)

export type SectionBlockProps = {
  sectionKey: SectionKey
  readOnly: boolean
  /** Focus the editor when it mounts (a section just added from the hints). */
  autoFocus?: boolean
  className?: string
}

/**
 * One report section: an `h3` label and its rich-text body.
 * An empty section with a prompt shows the muted prompt (click it to start typing) and, for
 * fixed sections, a dashed "Bez uwag" button. AI question gaps on the section are chips below
 * the body, as on incidents. The root has `id="section-<key>"` for jumps.
 */
export function SectionBlock({ sectionKey, readOnly, autoFocus, className }: SectionBlockProps) {
  const doc = useShift((s) => s.shift.sections[sectionKey]?.doc) ?? EMPTY
  const attachments = useShift((s) => s.shift.sections[sectionKey]?.attachments)
  const setSectionDoc = useShift((s) => s.setSectionDoc)
  const confirmNoRemarks = useShift((s) => s.confirmNoRemarks)
  const gaps = useShift((s) => s.shift.gaps)
  const chips = useMemo(
    () => sectionQuestionGaps(gaps, sectionKey).filter((g) => !readOnly || g.weight === 'required'),
    [gaps, sectionKey, readOnly],
  )
  const [editing, setEditing] = useState(false)

  const label = SECTION_LABELS[sectionKey]
  const headingId = `section-${sectionKey}-label`
  const empty = isDocEmpty(doc)
  const prompt = promptFor(sectionKey)

  const confirmable = empty && !readOnly && canConfirm(sectionKey)

  let body
  if (empty && readOnly) {
    body = <p className="text-muted-foreground">—</p>
  } else if (empty && prompt && !editing && !autoFocus) {
    body = (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="cursor-text rounded-sm text-left text-muted-foreground/65 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {prompt}
      </button>
    )
  } else {
    body = (
      <RichEditor
        doc={doc}
        onChange={(d) => setSectionDoc(sectionKey, d)}
        editable={!readOnly}
        placeholder={prompt}
        autoFocus={autoFocus || editing}
        onBlur={() => setEditing(false)}
        ariaLabel={label}
      />
    )
  }

  return (
    <section id={`section-${sectionKey}`} aria-labelledby={headingId} className={cn('scroll-mt-6', className)}>
      <div className="mb-2 flex min-h-7 items-center justify-between gap-3">
        <h3 id={headingId} className="text-lg font-semibold text-foreground">
          {label}
        </h3>
        {confirmable && !editing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => confirmNoRemarks(sectionKey)}
            className="relative h-7 gap-1.5 rounded-md border-dashed border-foreground/25 px-2.5 text-[13px] font-normal text-muted-foreground max-sm:before:absolute max-sm:before:inset-x-0 max-sm:before:-inset-y-2"
          >
            <CheckIcon aria-hidden className="size-3.5" />
            Bez uwag
          </Button>
        )}
      </div>
      {body}
      {attachments && attachments.length > 0 && (
        <div className="mt-2.5">
          <AttachmentTiles attachments={attachments} />
        </div>
      )}
      {chips.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {chips.map((g) => (
            <GapChip key={g.id} gap={g} readOnly={readOnly} />
          ))}
        </div>
      )}
    </section>
  )
}
