'use client'

import { Button } from '@/components/ui/button'
import { formatHHMM } from '@/lib/report/time'
import type { AiQuestion, Shift } from '@/lib/report/types'
import { useShift, type ShiftState } from '@/store/shift'

/** Open, and not already being answered by a note that is still processing. */
export function isAwaitingAnswer(shift: Shift, q: AiQuestion): boolean {
  return q.status === 'open' && !shift.notes.some((n) => n.replyTo === q.id && n.status === 'pending')
}

/**
 * The oldest question awaiting an answer. Returns a reference from the store, so it is
 * safe as a Zustand selector.
 */
export const selectOpenQuestion = (s: ShiftState): AiQuestion | undefined =>
  s.shift.sentAt ? undefined : s.shift.questions.find((q) => isAwaitingAnswer(s.shift, q))

/** The question shown in the card; the composer answers it (`replyTo`) while it is open. */
export function useOpenQuestion(): AiQuestion | undefined {
  return useShift(selectOpenQuestion)
}

/** Card above the input with the oldest open AI question and its quick replies (spec §4.2). */
export function AiQuestionCard() {
  const question = useOpenQuestion()
  const note = useShift((s) => (question ? s.shift.notes.find((n) => n.id === question.noteId) : undefined))
  const submitNote = useShift((s) => s.submitNote)

  if (!question) return null

  return (
    <section
      aria-label="Pytanie do notatki"
      className="flex flex-col gap-2.5 rounded-xl border border-input bg-card/60 px-3.5 py-3"
    >
      <p className="text-foreground/90">
        {note && <span className="text-muted-foreground">Pytanie do notatki z {formatHHMM(note.createdAt)} · </span>}
        {question.question}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {question.options.map((option) => (
          <Button
            key={option}
            variant="outline"
            className="h-[30px] rounded-full px-3 text-[13px] font-normal max-sm:h-9"
            onClick={() => void submitNote(option, [], { replyTo: question.id })}
          >
            {option}
          </Button>
        ))}
        <span className="ml-1 text-[13px] text-muted-foreground">…albo odpowiedz poniżej</span>
      </div>
    </section>
  )
}
