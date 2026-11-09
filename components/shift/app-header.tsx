'use client'

import { ArrowLeftIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { requiredCount } from '@/lib/report/gaps'
import { formatHHMM } from '@/lib/report/time'
import { useShift } from '@/store/shift'
import { DemoMenu } from './demo-menu'

export type AppHeaderProps = {
  /** "Wyślij raport" on the Raport tab: opens the review dialog. */
  onSend?: () => void
}

function ShiftStatus() {
  const startedAt = useShift((s) => s.shift.startedAt)
  const sentAt = useShift((s) => s.shift.sentAt)
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap text-muted-foreground">
      <span aria-hidden className={sentAt ? 'size-1.5 rounded-full bg-muted-foreground' : 'size-1.5 rounded-full bg-emerald-400'} />
      {/* Phones drop the "Zmiana" prefix so the primary button fits next to it. */}
      {sentAt ? (
        <>
          <span className="max-sm:hidden">Zmiana zamknięta</span>
          <span className="sm:hidden">Zamknięta</span>
        </>
      ) : (
        <>
          <span className="max-sm:hidden">Zmiana trwa · </span>
          {`od ${formatHHMM(startedAt)}`}
        </>
      )}
    </span>
  )
}

/** 32 px visually; on phones a 44 px hit area (the trigger is already `relative`). */
const TRIGGER =
  'h-8 flex-1 rounded-[7px] px-3.5 sm:flex-none max-sm:before:absolute max-sm:before:inset-x-0 max-sm:before:-inset-y-1.5'

function ShiftTabs() {
  // Once sent, open gaps are "brak danych" in the report; nothing is left to fill in.
  const required = useShift((s) => (s.shift.sentAt ? 0 : requiredCount(s.shift)))
  return (
    <TabsList aria-label="Widok zmiany" className="w-full rounded-[10px] border border-border bg-card/60 group-data-horizontal/tabs:h-10 sm:w-fit">
      <TabsTrigger value="journal" className={TRIGGER}>
        <span className="sm:hidden">Dziennik</span>
        <span className="hidden sm:inline">Dziennik zmiany</span>
      </TabsTrigger>
      <TabsTrigger value="report" className={TRIGGER}>
        Raport
        {required > 0 && (
          <Badge
            className="h-[18px] min-w-[18px] border-required-border bg-required-bg px-1.5 text-[11px] font-semibold text-required"
          >
            {required}
            <span className="sr-only"> do uzupełnienia</span>
          </Badge>
        )}
      </TabsTrigger>
    </TabsList>
  )
}

/** 36 px visually; on phones a 44 px hit area. */
const PRIMARY = 'relative h-9 px-3 sm:px-4 max-sm:before:absolute max-sm:before:inset-x-0 max-sm:before:-inset-y-1'

/**
 * Top bar: back (placeholder), shift status, the Dziennik/Raport tabs and the primary action.
 * Must be rendered inside the shell's `<Tabs>` root (it renders the `TabsList`).
 */
export function AppHeader({ onSend }: AppHeaderProps) {
  const tab = useShift((s) => s.tab)
  const setTab = useShift((s) => s.setTab)
  const sent = useShift((s) => Boolean(s.shift.sentAt))
  const newShift = useShift((s) => s.newShift)

  const primary =
    tab === 'journal' && sent ? (
      <Button onClick={newShift} className={PRIMARY}>
        Nowa zmiana
      </Button>
    ) : tab === 'journal' ? (
      <Button onClick={() => setTab('report')} className={PRIMARY}>
        Zobacz raport
      </Button>
    ) : (
      <Button onClick={onSend} disabled={sent} className={PRIMARY}>
        Wyślij raport
      </Button>
    )

  return (
    <header className="border-b border-border/60 px-3 pt-3 pb-2.5 sm:grid sm:grid-cols-3 sm:items-center sm:gap-3 sm:border-border sm:px-6 sm:py-3">
      <div className="flex items-center justify-between gap-2 sm:justify-start sm:gap-3">
        <Button variant="ghost" aria-label="Wróć do strony głównej" className="size-11 rounded-[10px] text-foreground/90 sm:h-8 sm:w-auto sm:rounded-lg sm:pr-2.5 sm:pl-1.5 [&_svg:not([class*='size-'])]:size-[18px]">
          <ArrowLeftIcon aria-hidden />
          <span className="hidden sm:inline">Wróć</span>
        </Button>
        <DemoMenu />
        <ShiftStatus />
        <div className="sm:hidden">{primary}</div>
      </div>
      <div className="mt-2.5 flex justify-center sm:mt-0">
        <ShiftTabs />
      </div>
      <div className="hidden justify-end sm:flex">{primary}</div>
    </header>
  )
}
