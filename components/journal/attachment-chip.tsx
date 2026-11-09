import { FileTextIcon, ImageIcon, VideoIcon, XIcon } from 'lucide-react'
import type { Attachment } from '@/lib/report/types'

const ICONS = { image: ImageIcon, video: VideoIcon, document: FileTextIcon } as const

/** File chip used in journal entries and in the composer (with `onRemove`). */
export function AttachmentChip({ attachment, onRemove }: { attachment: Attachment; onRemove?: () => void }) {
  const Icon = ICONS[attachment.kind]
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-md border border-input px-2 text-xs text-foreground/80">
      <Icon className="size-3" aria-hidden />
      {attachment.name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Usuń ${attachment.name}`}
          className="-mr-1 grid size-4 place-items-center rounded-sm text-muted-foreground hover:text-foreground"
        >
          <XIcon className="size-3" aria-hidden />
        </button>
      )}
    </span>
  )
}
