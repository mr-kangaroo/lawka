'use client'

import { AiQuestionCard } from '@/components/journal/ai-question-card'
import { Journal } from '@/components/journal/journal'
import { Composer } from '@/components/composer/composer'
import { ReportDocument } from '@/components/report/report-document'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { useHasHydrated } from '@/store/hydration'
import { useShift } from '@/store/shift'
import { AppHeader } from './app-header'

const PLACEHOLDERS = {
  journal: 'Co się dzieje? Pisz jak na czacie — np. „23:10 awantura na bramce”',
  report: 'Dopisz coś albo popraw — np. „incydent 2 był o 01:05”',
} as const

/** Phone placeholders: the spec copy up to the dash, as in the phone design. */
const COMPACT_PLACEHOLDERS = {
  journal: 'Co się dzieje?',
  report: 'Dopisz coś albo popraw',
} as const

export type AppShellProps = {
  /** Forwarded to the header's "Wyślij raport" button (Task 11). */
  onSend?: () => void
}

/**
 * The whole screen: header with tabs, the tab content in a scrolling column, and the
 * question card plus input pinned at the bottom. Renders only after the persisted store
 * has hydrated (see `useHasHydrated`).
 */
export function AppShell({ onSend }: AppShellProps) {
  const hydrated = useHasHydrated()
  const tab = useShift((s) => s.tab)
  const setTab = useShift((s) => s.setTab)

  if (!hydrated) return <div className="h-dvh bg-background" />

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v === 'report' ? 'report' : 'journal')}
      className="h-dvh gap-0"
    >
      <AppHeader onSend={onSend} />
      <main data-scroll-container className="min-h-0 flex-1 overflow-y-auto px-4 py-1 sm:p-6">
        <TabsContent value="journal" className="text-[15px] leading-relaxed">
          <Journal />
        </TabsContent>
        <TabsContent value="report" className="text-[15px]">
          <div className="mx-auto w-full max-w-[760px]">
            <ReportDocument />
          </div>
        </TabsContent>
      </main>
      <div className="px-3 pt-0 pb-4 sm:border-t sm:border-border/60 sm:px-6 sm:pt-3 sm:pb-5">
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-2.5">
          <AiQuestionCard />
          <Composer placeholder={PLACEHOLDERS[tab]} compactPlaceholder={COMPACT_PLACEHOLDERS[tab]} />
        </div>
      </div>
    </Tabs>
  )
}
