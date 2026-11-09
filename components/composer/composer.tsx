'use client'

import { useId, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowUpIcon, PaperclipIcon } from 'lucide-react'
import { toast } from 'sonner'
import { AttachmentChip } from '@/components/journal/attachment-chip'
import { useOpenQuestion } from '@/components/journal/ai-question-card'
import { Button } from '@/components/ui/button'
import type { Attachment } from '@/lib/report/types'
import { useShift } from '@/store/shift'
import { pickFakeAttachment } from './fake-attach'
import { FiledConfirmation } from './filed-confirmation'

const PHONE_QUERY = '(max-width: 639px)'

function subscribePhone(onChange: () => void) {
  const mq = window.matchMedia(PHONE_QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

/** True below Tailwind's `sm` breakpoint. */
function useIsPhone(): boolean {
  return useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE_QUERY).matches, () => false)
}

export type ComposerProps = {
  placeholder: string
  /** Shorter placeholder below 640 px, where the input is one line. Defaults to `placeholder`. */
  compactPlaceholder?: string
  /** Slot for the dictation button (Task 13). Renders nothing when omitted. */
  voiceSlot?: ReactNode
}

/**
 * The single input pinned at the bottom of both tabs (spec §4.2).
 * Enter submits, Shift+Enter adds a new line. While the AI question card is open, a
 * submitted note answers that question (`replyTo`).
 */
export function Composer({ placeholder, compactPlaceholder, voiceSlot }: ComposerProps) {
  const id = useId()
  const isPhone = useIsPhone()
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const submitNote = useShift((s) => s.submitNote)
  const tab = useShift((s) => s.tab)
  const sent = useShift((s) => Boolean(s.shift.sentAt))
  const question = useOpenQuestion()

  const canSubmit = !sent && (text.trim().length > 0 || attachments.length > 0)

  function submit() {
    if (!canSubmit) return
    void submitNote(text, attachments, question ? { replyTo: question.id } : undefined)
    setText('')
    setAttachments([])
    if (tab === 'report') toast('Dodano do dziennika')
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    submit()
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      <FiledConfirmation />
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-2 rounded-2xl border border-input bg-muted/40 p-2 focus-within:border-ring sm:rounded-[14px] sm:py-2.5 sm:pr-2.5 sm:pl-3.5"
      >
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-1 pt-1 sm:px-0">
            {attachments.map((a) => (
              <AttachmentChip
                key={a.id}
                attachment={a}
                onRemove={() => setAttachments((cur) => cur.filter((x) => x.id !== a.id))}
              />
            ))}
          </div>
        )}
        <div className="flex items-end gap-1.5 sm:gap-2">
          <label htmlFor={id} className="sr-only">
            Nowa notatka
          </label>
          <textarea
            id={id}
            rows={1}
            value={text}
            disabled={sent}
            placeholder={isPhone && compactPlaceholder ? compactPlaceholder : placeholder}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            className="max-h-40 min-h-11 min-w-0 flex-1 resize-none bg-transparent py-2.5 text-base leading-normal outline-none [field-sizing:content] placeholder:text-muted-foreground disabled:cursor-not-allowed sm:min-h-[54px] sm:py-1 sm:text-[15px]"
          />
          {voiceSlot}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={sent}
            aria-label="Dołącz plik"
            onClick={() => {
              const file = pickFakeAttachment() // outside the updater: StrictMode runs updaters twice
              setAttachments((cur) => [...cur, file])
            }}
            className="order-first size-11 rounded-[10px] text-foreground/80 sm:order-none sm:size-9 sm:rounded-lg [&_svg:not([class*='size-'])]:size-[18px]"
          >
            <PaperclipIcon />
          </Button>
          <Button
            type="submit"
            disabled={!canSubmit}
            aria-label="Dodaj notatkę"
            className="size-11 rounded-full sm:h-9 sm:w-auto sm:rounded-lg sm:px-3.5"
          >
            <ArrowUpIcon className="sm:hidden" aria-hidden />
            <span className="hidden sm:inline">Dodaj ↵</span>
          </Button>
        </div>
      </form>
    </div>
  )
}
