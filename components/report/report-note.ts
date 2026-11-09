import { toast } from 'sonner'
import type { Attachment } from '@/lib/report/types'
import { useShift } from '@/store/shift'

/** Resolves when the note is filed; rejects with its id when it failed, so the toast can offer "Ponów". */
async function filed(run: Promise<string | undefined>): Promise<void> {
  const id = await run
  if (id && useShift.getState().shift.notes.find((n) => n.id === id)?.status === 'failed') throw id
}

function track(run: Promise<string | undefined>) {
  toast.promise(filed(run), {
    loading: 'Uwzględniam w raporcie…',
    success: 'Raport zaktualizowany',
    error: (id: string) => ({
      message: 'Nie udało się uwzględnić notatki',
      duration: 10000,
      action: {
        label: 'Ponów',
        onClick: () => track(useShift.getState().retryNote(id).then(() => id)),
      },
    }),
  })
}

/**
 * Sends a note written in the Raport tab (a correction or a gap answer). Those notes are not shown
 * in the journal, so their progress and failures (with "Ponów") are shown in a toast instead.
 */
export function submitFromReport(text: string, attachments: Attachment[], opts?: { answersGapId?: string }) {
  track(useShift.getState().submitNote(text, attachments, opts))
}
