import type { BlockAttrs, RichBlock, RichDoc, RichInline } from './types'

const text = (t: string): RichInline[] => (t ? [{ type: 'text', text: t }] : [])
const withAttrs = (a: BlockAttrs): BlockAttrs => ({ ...a, sourceNoteIds: [...a.sourceNoteIds] })

export function emptyDoc(): RichDoc {
  return { type: 'doc', content: [] }
}

export function paragraphsToBlocks(paragraphs: string[], attrs: BlockAttrs): RichBlock[] {
  const blocks: RichBlock[] = []
  let items: string[] = []
  const flush = () => {
    if (!items.length) return
    blocks.push({
      type: 'bulletList',
      attrs: withAttrs(attrs),
      content: items.map((t) => ({
        type: 'listItem' as const,
        content: [{ type: 'paragraph' as const, content: text(t) }],
      })),
    })
    items = []
  }
  for (const p of paragraphs) {
    if (p.startsWith('- ')) {
      items.push(p.slice(2))
    } else {
      flush()
      blocks.push({ type: 'paragraph', attrs: withAttrs(attrs), content: text(p) })
    }
  }
  flush()
  return blocks
}

export function appendBlocks(doc: RichDoc, blocks: RichBlock[]): RichDoc {
  return { ...doc, content: [...doc.content, ...structuredClone(blocks)] }
}

export function appendSentence(doc: RichDoc, sentence: string, attrs: BlockAttrs): RichDoc {
  const last = doc.content[doc.content.length - 1]
  if (last && last.type === 'paragraph' && last.attrs.by === 'ai') {
    const merged: RichBlock = {
      ...last,
      attrs: withAttrs({
        ...last.attrs,
        sourceNoteIds: [...new Set([...last.attrs.sourceNoteIds, ...attrs.sourceNoteIds])],
      }),
      content: [
        ...(last.content ?? []).map((i) => structuredClone(i)),
        ...text(last.content?.length ? ` ${sentence}` : sentence),
      ],
    }
    return { ...doc, content: [...doc.content.slice(0, -1), merged] }
  }
  return appendBlocks(doc, paragraphsToBlocks([sentence], attrs))
}

/** Drops ai blocks and appends the new ones after the manager blocks. */
export function replaceAiBlocks(doc: RichDoc, blocks: RichBlock[]): RichDoc {
  const kept = doc.content.filter((b) => b.attrs.by === 'manager')
  return { ...doc, content: [...structuredClone(kept), ...structuredClone(blocks)] }
}

export function hasManagerBlocks(doc: RichDoc): boolean {
  return doc.content.some((b) => b.attrs.by === 'manager')
}

const inlineText = (c?: RichInline[]) => (c ?? []).map((i) => i.text).join('')

function blockLines(b: RichBlock): string[] {
  if (b.type === 'paragraph') return [inlineText(b.content)]
  return b.content.map((li) => `- ${li.content.map((p) => inlineText(p.content)).join(' ')}`)
}

export function docToPlainText(doc: RichDoc): string {
  return doc.content.flatMap(blockLines).join('\n')
}

export function isDocEmpty(doc: RichDoc): boolean {
  return doc.content.every((b) =>
    b.type === 'paragraph'
      ? inlineText(b.content).trim() === ''
      : b.content.every((li) => li.content.every((p) => inlineText(p.content).trim() === '')),
  )
}
