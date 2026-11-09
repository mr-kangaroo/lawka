'use client'

import { CornerDownLeftIcon } from 'lucide-react'
import { toast } from 'sonner'
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

/** Pill button; 30 px visually on desktop, 36 px on phones with a 44 px hit area. */
const PILL =
  'relative h-[30px] rounded-full px-3 text-[13px] font-normal max-sm:h-9 max-sm:before:absolute max-sm:before:inset-x-0 max-sm:before:-inset-y-1'

export type AiQuestionCardProps = {
  /** "Odpowiedz": puts the composer into reply mode for this question. */
  onReply?: (questionId: string) => void
  /** The composer is already in reply mode for the shown question. */
  replying?: boolean
}

/**
 * Card above the input with the oldest open AI question, its quick replies and "Odpowiedz"
 * (spec §4.2, amended: typing in the input answers only after "Odpowiedz").
 */
export function AiQuestionCard({ onReply, replying = false }: AiQuestionCardProps) {
  const question = useOpenQuestion()
  const note = useShift((s) => (question ? s.shift.notes.find((n) => n.id === question.noteId) : undefined))
  const submitNote = useShift((s) => s.submitNote)

  if (!question) return null

  function quickReply(option: string) {
    if (!question) return
    void submitNote(option, [], { replyTo: question.id })
    if (useShift.getState().tab === 'report') toast('Dodano do dziennika')
  }

  return (
    <section
      aria-label="Pytanie do notatki"
      className="flex flex-col gap-2.5 rounded-xl border border-input bg-card/60 px-3.5 py-3"
    >
      <p className="text-foreground/90">
        {note && <span className="text-muted-foreground">Pytanie do notatki z {formatHHMM(note.createdAt)} · </span>}
        {question.question}
      </p>
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5 max-sm:gap-y-2">
        {question.options.map((option) => (
          <Button key={option} variant="outline" className={PILL} onClick={() => quickReply(option)}>
            {option}
          </Button>
        ))}
        {onReply && (
          <Button
            variant="ghost"
            aria-pressed={replying}
            className={`${PILL} text-muted-foreground aria-pressed:bg-muted aria-pressed:text-foreground`}
            onClick={() => onReply(question.id)}
          >
            <CornerDownLeftIcon aria-hidden />
            Odpowiedz
          </Button>
        )}
      </div>
    </section>
  )
}
