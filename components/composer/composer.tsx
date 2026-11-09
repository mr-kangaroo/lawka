'use client'

import {
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { ArrowUpIcon, MicIcon, PaperclipIcon } from 'lucide-react'
import { toast } from 'sonner'
import { AttachmentChip } from '@/components/journal/attachment-chip'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Attachment } from '@/lib/report/types'
import { useShift } from '@/store/shift'
import { useSpeech } from './use-speech'
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
}

/**
 * The single input pinned at the bottom of both tabs (spec §4.2).
 * Enter submits, Shift+Enter adds a new line.
 */
export function Composer({ placeholder, compactPlaceholder }: ComposerProps) {
  const id = useId()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isPhone = useIsPhone()
  const speech = useSpeech()
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const submitNote = useShift((s) => s.submitNote)
  const tab = useShift((s) => s.tab)
  const sent = useShift((s) => Boolean(s.shift.sentAt))
  const canSubmit = !sent && (text.trim().length > 0 || attachments.length > 0)

  function submit() {
    if (!canSubmit) return
    speech.cancel()
    void submitNote(text, attachments)
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
            ref={textareaRef}
            rows={1}
            value={text}
            disabled={sent}
            placeholder={isPhone && compactPlaceholder ? compactPlaceholder : placeholder}
            onChange={(e) => {
              speech.cancel() // typing mid-dictation would be overwritten by the next result
              setText(e.target.value)
            }}
            onKeyDown={onKeyDown}
            className="max-h-40 min-h-11 min-w-0 flex-1 resize-none bg-transparent py-2.5 text-base leading-normal outline-none [field-sizing:content] placeholder:text-muted-foreground disabled:cursor-not-allowed sm:min-h-[54px] sm:py-1 sm:text-[15px]"
          />
          {speech.supported && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={sent}
              aria-pressed={speech.listening}
              aria-label={speech.listening ? 'Zatrzymaj dyktowanie' : 'Dyktuj notatkę'}
              onClick={() => {
                if (speech.listening) return speech.stop()
                speech.start({
                  base: text,
                  onText: setText,
                  onDenied: () => toast('Brak dostępu do mikrofonu'),
                })
              }}
              className={cn(
                'relative size-11 rounded-[10px] text-foreground/80 sm:size-9 sm:rounded-lg [&_svg:not([class*="size-"])]:size-[18px]',
                speech.listening && 'bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive',
              )}
            >
              <MicIcon />
              {speech.listening && (
                <span
                  aria-hidden
                  className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive motion-safe:animate-pulse sm:top-1 sm:right-1"
                />
              )}
            </Button>
          )}
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
            className="size-11 rounded-full sm:h-9 sm:w-auto sm:rounded-lg sm:px-3.5"
          >
            <ArrowUpIcon className="sm:hidden" aria-hidden />
            <span className="max-sm:sr-only">Dodaj</span>
            <span aria-hidden className="hidden sm:inline">
              ↵
            </span>
          </Button>
        </div>
      </form>
    </div>
  )
}
