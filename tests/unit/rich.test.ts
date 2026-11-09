import { describe, expect, it } from 'vitest'
import {
  appendBlocks,
  appendSentence,
  docToPlainText,
  emptyDoc,
  hasManagerBlocks,
  isDocEmpty,
  paragraphsToBlocks,
  replaceAiBlocks,
} from '@/lib/report/rich'
import type { BlockAttrs, RichDoc } from '@/lib/report/types'

const ai: BlockAttrs = { by: 'ai', at: '2026-11-08T22:00:00.000Z', sourceNoteIds: ['n1'] }
const mgr: BlockAttrs = { by: 'manager', at: '2026-11-08T23:00:00.000Z', sourceNoteIds: [] }

describe('paragraphsToBlocks', () => {
  it('groups consecutive "- " lines into one bulletList', () => {
    const blocks = paragraphsToBlocks(['A', '- x', '- y', 'B'], ai)
    expect(blocks).toHaveLength(3)
    expect(blocks[0].type).toBe('paragraph')
    expect(blocks[1].type).toBe('bulletList')
    if (blocks[1].type === 'bulletList') expect(blocks[1].content).toHaveLength(2)
    expect(blocks[2].type).toBe('paragraph')
    expect(blocks.every((b) => b.attrs.by === 'ai')).toBe(true)
  })
})

describe('doc helpers', () => {
  const docOf = (...p: [string, BlockAttrs][]): RichDoc =>
    p.reduce((d, [t, a]) => appendBlocks(d, paragraphsToBlocks([t], a)), emptyDoc())

  it('emptyDoc is empty', () => {
    expect(isDocEmpty(emptyDoc())).toBe(true)
    expect(hasManagerBlocks(emptyDoc())).toBe(false)
  })

  it('isDocEmpty is false with text, true with blank paragraph', () => {
    expect(isDocEmpty(docOf(['A.', ai]))).toBe(false)
    expect(isDocEmpty(docOf(['  ', ai]))).toBe(true)
  })

  it('appendSentence extends a trailing ai paragraph', () => {
    const doc = docOf(['A.', ai])
    const snap = structuredClone(doc)
    const out = appendSentence(doc, 'B.', ai)
    expect(docToPlainText(doc)).toBe('A.')
    expect(docToPlainText(out)).toBe('A. B.')
    expect(out.content).toHaveLength(1)
    expect(doc).toEqual(snap)
  })

  it('appendSentence adds a new block after a manager block', () => {
    const doc = docOf(['A.', mgr])
    const snap = structuredClone(doc)
    const out = appendSentence(doc, 'B.', ai)
    expect(out.content).toHaveLength(2)
    expect(docToPlainText(out)).toBe('A.\nB.')
    expect(doc).toEqual(snap)
  })

  it('appendSentence on an empty doc adds a paragraph', () => {
    expect(docToPlainText(appendSentence(emptyDoc(), 'B.', ai))).toBe('B.')
  })

  it('replaceAiBlocks keeps manager blocks in place', () => {
    const doc = docOf(['old1', ai], ['mine', mgr], ['old2', ai])
    const snap = structuredClone(doc)
    const out = replaceAiBlocks(doc, paragraphsToBlocks(['new'], ai))
    expect(out.content.filter((b) => b.attrs.by === 'manager')).toHaveLength(1)
    expect(docToPlainText(out)).toBe('mine\nnew')
    expect(doc).toEqual(snap)
  })

  it('hasManagerBlocks', () => {
    expect(hasManagerBlocks(docOf(['A', ai]))).toBe(false)
    expect(hasManagerBlocks(docOf(['A', ai], ['B', mgr]))).toBe(true)
  })

  it('docToPlainText prefixes bullets', () => {
    const doc = appendBlocks(emptyDoc(), paragraphsToBlocks(['A', '- x', '- y'], ai))
    expect(docToPlainText(doc)).toBe('A\n- x\n- y')
  })

  it('appendBlocks does not mutate', () => {
    const doc = docOf(['A', ai])
    const snap = structuredClone(doc)
    const blocks = paragraphsToBlocks(['B'], ai)
    const bsnap = structuredClone(blocks)
    appendBlocks(doc, blocks)
    expect(doc).toEqual(snap)
    expect(blocks).toEqual(bsnap)
  })
})
