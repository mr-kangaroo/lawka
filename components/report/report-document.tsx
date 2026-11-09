'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { CONDITIONAL_SECTIONS } from '@/lib/report/catalog'
import type { SectionKey } from '@/lib/report/types'
import { SentBanner } from '@/components/shift/sent-banner'
import { useShift } from '@/store/shift'
import { Incidents } from './incidents'
import { ReportProperties } from './report-properties'
import { SectionBlock } from './section-block'
import { SectionHints } from './section-hints'

const FIXED_AFTER_INCIDENTS: SectionKey[] = ['audience', 'security', 'maintenance']

/**
 * The Raport tab: fixed title and properties, Podsumowanie, the Incydenty slot, the other
 * fixed sections, any present conditional sections, then the section hints (spec §4.3, §4.5).
 * Read-only once the shift has been sent.
 */
export function ReportDocument() {
  const readOnly = useShift((s) => !!s.shift.sentAt)
  const sections = useShift((s) => s.shift.sections)
  const addSection = useShift((s) => s.addSection)
  // The section just added from a hint; its editor takes focus when it mounts.
  const [added, setAdded] = useState<SectionKey | null>(null)

  const conditional = CONDITIONAL_SECTIONS.filter((k) => sections[k])

  // The tabs share one scroll container; the Dziennik leaves it at the newest note.
  const ref = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    ref.current?.closest('[data-scroll-container]')?.scrollTo({ top: 0 })
  }, [])

  return (
    <article
      ref={ref}
      aria-label="Raport — dokument"
      className="flex flex-col pt-6 pb-6 text-[15px] leading-[1.65] text-foreground/90 sm:px-6 sm:pt-8"
    >
      <SentBanner />
      <header className="mb-6 flex flex-col gap-3">
        <h1 className="mb-1 text-[28px] leading-tight font-semibold text-foreground">Raport ze zmiany</h1>
        <ReportProperties readOnly={readOnly} />
        <div className="mt-2 h-px bg-border" />
      </header>

      <SectionBlock sectionKey="summary" readOnly={readOnly} className="mt-2" />
      <Incidents />
      {[...FIXED_AFTER_INCIDENTS, ...conditional].map((key) => (
        <SectionBlock key={key} sectionKey={key} readOnly={readOnly} autoFocus={key === added} className="mt-5" />
      ))}

      {!readOnly && (
        <SectionHints
          className="mt-7"
          onAdd={(key) => {
            addSection(key)
            setAdded(key)
          }}
        />
      )}
    </article>
  )
}
