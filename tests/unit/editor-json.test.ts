import { describe, expect, it } from 'vitest'
import { fromEditorDoc, mergeDocs, toEditorDoc } from '@/lib/report/editor-json'
import type { BlockAttrs, RichBlock, RichDoc } from '@/lib/report/types'

const AT = '2026-11-08T21:00:00.000Z'
const ai: BlockAttrs = { by: 'ai', at: AT, sourceNoteIds: ['n1'] }
const mgr: BlockAttrs = { by: 'manager', at: AT, sourceNoteIds: [] }
const p = (text: string, attrs = ai): RichBlock => ({ type: 'paragraph', attrs, content: [{ type: 'text', text }] })
const doc = (...content: RichBlock[]): RichDoc => ({ type: 'doc', content })
const texts = (d: RichDoc) => d.content.map((b) => (b.type === 'paragraph' ? b.content?.[0]?.text : 'list'))

describe('toEditorDoc', () => {
  it('turns an empty doc into one empty paragraph', () => {
    expect(toEditorDoc(doc())).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] })
  })

  it('passes blocks through unchanged', () => {
    const d = doc(p('A'))
    expect(toEditorDoc(d)).toEqual(d)
  })
})

describe('fromEditorDoc', () => {
  it('keeps top-level attrs and bold/italic, strips nested attrs and other marks', () => {
    const json = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: ai,
          content: [{ type: 'text', text: 'Hej', marks: [{ type: 'bold' }, { type: 'link', attrs: { href: 'x' } }] }],
        },
        {
          type: 'bulletList',
          attrs: mgr,
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', attrs: mgr, content: [{ type: 'text', text: 'Punkt' }] }] },
          ],
        },
      ],
    }
    expect(fromEditorDoc(json)).toEqual(
      doc(
        { type: 'paragraph', attrs: ai, content: [{ type: 'text', text: 'Hej', marks: [{ type: 'bold' }] }] },
        {
          type: 'bulletList',
          attrs: mgr,
          content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Punkt' }] }] }],
        },
      ),
    )
  })

  it('fills a missing `at` and defaults `by` to manager', () => {
    const out = fromEditorDoc({ type: 'doc', content: [{ type: 'paragraph', attrs: { at: null }, content: [{ type: 'text', text: 'x' }] }] }, AT)
    expect(out.content[0].attrs).toEqual({ by: 'manager', at: AT, sourceNoteIds: [] })
  })

  it('returns an empty doc when there is no text', () => {
    expect(fromEditorDoc({ type: 'doc', content: [{ type: 'paragraph', attrs: mgr }] })).toEqual(doc())
  })

  it('flattens nested lists into sibling items', () => {
    const li = (t: string, nested?: object) => ({
      type: 'listItem',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }, ...(nested ? [nested] : [])],
    })
    const out = fromEditorDoc({
      type: 'doc',
      content: [{ type: 'bulletList', attrs: mgr, content: [li('a', { type: 'bulletList', content: [li('b')] }), li('c')] }],
    })
    const list = out.content[0]
    expect(list.type === 'bulletList' && list.content.map((i) => i.content[0].content?.[0].text)).toEqual(['a', 'b', 'c'])
  })
})

describe('mergeDocs', () => {
  const base = doc(p('A'), p('B'), p('C'))

  it('takes the external doc when there were no local edits', () => {
    expect(mergeDocs(base, base, doc(p('A'), p('X')))).toEqual(doc(p('A'), p('X')))
  })

  it('takes the local doc when the external side did not change', () => {
    const local = doc(p('A!', mgr), p('B'), p('C'))
    expect(mergeDocs(base, local, base)).toEqual(local)
  })

  it('keeps both when they touched different blocks', () => {
    const local = doc(p('A!', mgr), p('B'), p('C'))
    const external = doc(p('A'), p('B'), p('C'), p('D'))
    expect(texts(mergeDocs(base, local, external))).toEqual(['A!', 'B', 'C', 'D'])
  })

  it('keeps both when external edited an earlier block than local', () => {
    const local = doc(p('A'), p('B'), p('C!', mgr))
    const external = doc(p('A+'), p('B'), p('C'))
    expect(texts(mergeDocs(base, local, external))).toEqual(['A+', 'B', 'C!'])
  })

  it('on a conflict keeps the local version and appends the external new blocks', () => {
    const local = doc(p('A'), p('B'), p('C!', mgr))
    const external = doc(p('A'), p('B'), p('C plus zdanie.'))
    expect(texts(mergeDocs(base, local, external))).toEqual(['A', 'B', 'C!', 'C plus zdanie.'])
  })

  it('merges from an empty base', () => {
    expect(texts(mergeDocs(doc(), doc(p('Moje', mgr)), doc(p('AI'))))).toEqual(['Moje', 'AI'])
  })
})
