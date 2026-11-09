import type { Attachment } from '@/lib/report/types'

const FAKE_FILES: Pick<Attachment, 'name' | 'kind'>[] = [
  { name: 'IMG_2232.jpg', kind: 'image' },
  { name: 'nagranie.mp4', kind: 'video' },
  { name: 'protokol.pdf', kind: 'document' },
]

let next = 0

/** A fake attachment; each call returns the next file in the cycle. */
export function pickFakeAttachment(): Attachment {
  const file = FAKE_FILES[next % FAKE_FILES.length]
  next += 1
  return { id: crypto.randomUUID(), ...file }
}
