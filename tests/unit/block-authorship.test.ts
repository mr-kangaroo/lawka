// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { afterEach, describe, expect, it } from 'vitest'
import { BlockAuthorship } from '@/components/report/block-authorship'

const AI_AT = '2026-11-08T21:00:00.000Z'
const ai = (text: string, sourceNoteIds = ['n1']) => ({
  type: 'paragraph',
  attrs: { by: 'ai', at: AI_AT, sourceNoteIds },
  content: [{ type: 'text', text }],
})

let editor: Editor | undefined

function makeEditor(content: object) {
  editor = new Editor({
    extensions: [StarterKit.configure({ heading: false, trailingNode: false }), BlockAuthorship],
    content,
  })
  return editor
}

afterEach(() => {
  editor?.destroy()
  editor = undefined
})

/** Position just inside the end of the top-level block at `index`. */
function endOfBlock(e: Editor, index: number): number {
  let pos = 0
  for (let i = 0; i < index; i++) pos += e.state.doc.child(i).nodeSize
  return pos + e.state.doc.child(index).nodeSize - 1
}

describe('BlockAuthorship', () => {
  it('keeps the attrs of blocks loaded from JSON', () => {
    const e = makeEditor({ type: 'doc', content: [ai('Pierwszy.'), ai('Drugi.', ['n2'])] })
    const blocks = e.getJSON().content!
    expect(blocks[0].attrs).toEqual({ by: 'ai', at: AI_AT, sourceNoteIds: ['n1'] })
    expect(blocks[1].attrs).toEqual({ by: 'ai', at: AI_AT, sourceNoteIds: ['n2'] })
  })

  it('marks only the block the user typed in as manager-authored', () => {
    const e = makeEditor({ type: 'doc', content: [ai('Pierwszy.'), ai('Drugi.', ['n2'])] })
    const before = Date.now()
    e.chain().setTextSelection(endOfBlock(e, 1)).insertContent(' Dopisane.').run()

    const [first, second] = e.getJSON().content!
    expect(first.attrs).toEqual({ by: 'ai', at: AI_AT, sourceNoteIds: ['n1'] })
    expect(second.attrs?.by).toBe('manager')
    expect(Date.parse(second.attrs?.at)).toBeGreaterThanOrEqual(before - 1)
    expect(second.attrs?.sourceNoteIds).toEqual(['n2'])
    expect(e.state.doc.child(1).textContent).toBe('Drugi. Dopisane.')
  })

  it('marks a touched bullet list (not its nested paragraphs) as manager-authored', () => {
    const e = makeEditor({
      type: 'doc',
      content: [
        ai('Akapit.'),
        {
          type: 'bulletList',
          attrs: { by: 'ai', at: AI_AT, sourceNoteIds: ['n3'] },
          content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Punkt' }] }] }],
        },
      ],
    })
    // Inside the list item's paragraph: list(1) + item(1) + paragraph(1) + "Punkt"(5).
    const listStart = e.state.doc.child(0).nodeSize
    e.chain().setTextSelection(listStart + 3 + 5).insertContent('!').run()

    const [para, list] = e.getJSON().content!
    expect(para.attrs?.by).toBe('ai')
    expect(list.attrs?.by).toBe('manager')
  })

  it('keeps the given attrs on setContent with meta external', () => {
    const e = makeEditor({ type: 'doc', content: [ai('Stary.')] })
    const next = { type: 'doc', content: [ai('Nowy pierwszy.', ['n7']), ai('Nowy drugi.', ['n8'])] }
    e.chain().setMeta('external', true).setContent(next, { emitUpdate: false }).run()

    const blocks = e.getJSON().content!
    expect(blocks.map((b) => b.attrs)).toEqual([
      { by: 'ai', at: AI_AT, sourceNoteIds: ['n7'] },
      { by: 'ai', at: AI_AT, sourceNoteIds: ['n8'] },
    ])
  })

  it('creates blocks typed from scratch as manager-authored', () => {
    const e = makeEditor({ type: 'doc', content: [{ type: 'paragraph' }] })
    e.chain().setTextSelection(1).insertContent('Nowy tekst').run()
    const [block] = e.getJSON().content!
    expect(block.attrs?.by).toBe('manager')
    expect(typeof block.attrs?.at).toBe('string')
    expect(block.attrs?.at).not.toBe('')
  })

  it('does not block input rules ("- " still starts a bullet list)', () => {
    const e = makeEditor({ type: 'doc', content: [{ type: 'paragraph' }] })
    e.commands.insertContentAt(1, '-')
    // Simulate typing the trigger character the way ProseMirror does for real keyboard input.
    const v = e.view
    const pos = v.state.selection.from
    v.someProp('handleTextInput', (f) => f(v, pos, pos, ' ', () => v.state.tr.insertText(' ', pos, pos)))

    const [block] = e.getJSON().content!
    expect(block.type).toBe('bulletList')
    expect(block.attrs?.by).toBe('manager')
  })

  it('refreshes `at` on a manager block stamped more than a minute ago', () => {
    const old = new Date(Date.now() - 5 * 60_000).toISOString()
    const e = makeEditor({
      type: 'doc',
      content: [{ type: 'paragraph', attrs: { by: 'manager', at: old, sourceNoteIds: [] }, content: [{ type: 'text', text: 'Bez uwag.' }] }],
    })
    e.chain().setTextSelection(endOfBlock(e, 0)).insertContent(' Dopisek.').run()
    expect(Date.parse(e.getJSON().content![0].attrs?.at)).toBeGreaterThan(Date.parse(old))
  })
})
