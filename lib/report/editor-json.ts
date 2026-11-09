import type { JSONContent } from '@tiptap/core'
import { emptyDoc, isDocEmpty } from './rich'
import type { BlockAttrs, RichBlock, RichDoc, RichInline } from './types'

type ListItem = Extract<RichBlock, { type: 'bulletList' }>['content'][number]
type ListParagraph = ListItem['content'][number]

/** RichDoc → Tiptap JSON. An empty doc becomes one empty paragraph (`doc` needs `block+`). */
export function toEditorDoc(doc: RichDoc): JSONContent {
  const content = structuredClone(doc.content) as JSONContent[]
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] }
}

function normAttrs(attrs: Record<string, unknown> | undefined, now: string): BlockAttrs {
  const by = attrs?.by === 'ai' ? 'ai' : 'manager'
  const at = typeof attrs?.at === 'string' && attrs.at ? attrs.at : now
  const ids = Array.isArray(attrs?.sourceNoteIds)
    ? attrs.sourceNoteIds.filter((x): x is string => typeof x === 'string')
    : []
  return { by, at, sourceNoteIds: ids }
}

function inlines(content: JSONContent[] | undefined): RichInline[] {
  const out: RichInline[] = []
  for (const n of content ?? []) {
    if (n.type !== 'text' || !n.text) continue
    const marks = (n.marks ?? [])
      .map((m) => m.type)
      .filter((t): t is 'bold' | 'italic' => t === 'bold' || t === 'italic')
      .map((type) => ({ type }))
    out.push(marks.length ? { type: 'text', text: n.text, marks } : { type: 'text', text: n.text })
  }
  return out
}

const paragraph = (n: JSONContent): ListParagraph => {
  const c = inlines(n.content)
  return c.length ? { type: 'paragraph', content: c } : { type: 'paragraph' }
}

/** Flattens a list item: its paragraphs stay, nested lists become sibling items after it. */
function listItems(list: JSONContent): ListItem[] {
  const out: ListItem[] = []
  for (const li of list.content ?? []) {
    const paras = (li.content ?? []).filter((n) => n.type === 'paragraph').map(paragraph)
    out.push({ type: 'listItem', content: paras.length ? paras : [{ type: 'paragraph' }] })
    for (const nested of (li.content ?? []).filter((n) => n.type === 'bulletList')) out.push(...listItems(nested))
  }
  return out
}

/**
 * Tiptap JSON → RichDoc. Keeps only paragraph, bulletList, listItem, text and bold/italic;
 * attrs stay on top-level blocks only. A doc with no text at all becomes `emptyDoc()`, so an
 * untouched or cleared editor never stores a stray manager paragraph.
 */
export function fromEditorDoc(json: JSONContent, now = new Date().toISOString()): RichDoc {
  const blocks: RichBlock[] = []
  for (const b of json.content ?? []) {
    const attrs = normAttrs(b.attrs, now)
    if (b.type === 'paragraph') {
      const c = inlines(b.content)
      blocks.push(c.length ? { type: 'paragraph', attrs, content: c } : { type: 'paragraph', attrs })
    } else if (b.type === 'bulletList') {
      blocks.push({ type: 'bulletList', attrs, content: listItems(b) })
    }
  }
  const doc: RichDoc = { type: 'doc', content: blocks }
  return isDocEmpty(doc) ? emptyDoc() : doc
}

export const docKey = (doc: RichDoc): string => JSON.stringify(doc.content)

type Region = { from: number; to: number; blocks: RichBlock[] }

/** The span of `base` (in base indices) that `other` replaced, and what it put there. */
function changedRegion(base: string[], other: string[], otherBlocks: RichBlock[]): Region {
  let p = 0
  while (p < base.length && p < other.length && base[p] === other[p]) p++
  let s = 0
  while (s < base.length - p && s < other.length - p && base[base.length - 1 - s] === other[other.length - 1 - s]) s++
  return { from: p, to: base.length - s, blocks: otherBlocks.slice(p, other.length - s) }
}

/**
 * Block-level three-way merge, used when the store changed while the user was typing.
 * `base` is the doc both sides last agreed on. Edits to different blocks are both kept; when
 * both sides touched the same blocks, the user's version wins and the external side's new
 * blocks are appended after it (duplication is visible and fixable; silent loss is not).
 */
export function mergeDocs(base: RichDoc, local: RichDoc, external: RichDoc): RichDoc {
  const key = (b: RichBlock) => JSON.stringify(b)
  const B = base.content.map(key)
  const L = local.content.map(key)
  const X = external.content.map(key)
  if (L.join('\n') === B.join('\n')) return structuredClone(external)
  if (X.join('\n') === B.join('\n') || X.join('\n') === L.join('\n')) return structuredClone(local)

  const rl = changedRegion(B, L, local.content)
  const rx = changedRegion(B, X, external.content)
  const overlap = rl.from < rx.to && rx.from < rl.to
  const touchInside = (point: Region, span: Region) =>
    point.from === point.to && span.from < point.from && point.from < span.to
  if (!overlap && !touchInside(rl, rx) && !touchInside(rx, rl)) {
    // Local first on a tie (both inserted at the same point).
    const [a, b] = rl.from <= rx.from && rl.to <= rx.from ? [rl, rx] : [rx, rl]
    return structuredClone({
      type: 'doc',
      content: [
        ...base.content.slice(0, a.from),
        ...a.blocks,
        ...base.content.slice(a.to, b.from),
        ...b.blocks,
        ...base.content.slice(b.to),
      ],
    })
  }
  const kept = new Set(L)
  const added = rx.blocks.filter((b) => !kept.has(key(b)))
  return structuredClone({ type: 'doc', content: [...local.content, ...added] })
}
