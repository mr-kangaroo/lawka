import { FileTextIcon, ImageIcon, PlayIcon } from 'lucide-react'
import type { Attachment } from '@/lib/report/types'

const ICONS = { image: ImageIcon, video: PlayIcon, document: FileTextIcon } as const
const KIND_LABEL = { image: 'Zdjęcie', video: 'Wideo', document: 'Dokument' } as const

/**
 * Attachments inside the report: a placeholder thumbnail per file (no real file handling, per the
 * brief: chips, a fake upload and a thumbnail placeholder) with the file name under it.
 */
export function AttachmentTiles({ attachments }: { attachments: Attachment[] }) {
  if (attachments.length === 0) return null
  return (
    <ul aria-label="Załączniki" className="flex flex-wrap gap-2.5">
      {attachments.map((a) => {
        const Icon = ICONS[a.kind]
        return (
          <li key={a.id} className="flex w-24 flex-col gap-1">
            <div
              role="img"
              aria-label={`${KIND_LABEL[a.kind]}: ${a.name}`}
              className="grid aspect-[4/3] place-items-center rounded-md border border-input bg-[repeating-linear-gradient(135deg,var(--muted)_0_6px,transparent_6px_12px)] text-muted-foreground"
            >
              <span className="grid size-7 place-items-center rounded-full bg-background/80">
                <Icon className="size-3.5" aria-hidden />
              </span>
            </div>
            <span className="truncate text-xs text-muted-foreground" title={a.name}>
              {a.name}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
