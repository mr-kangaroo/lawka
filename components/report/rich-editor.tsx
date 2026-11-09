'use client'

import type { Editor } from '@tiptap/core'
import { ListItem } from '@tiptap/extension-list'
import { Placeholder } from '@tiptap/extensions'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { cn } from 'cn'
import { useEffect, useMemo, useRef, useState } from 'react'
import { docKey, fromEditorDoc, mergeDocs, toEditorDoc } from '@/lib/report/editor-json'
import type { RichDoc } from '@/lib/report/types'
import { BlockAuthorship, EXTERNAL_META } from './block-authorship'

const DEBOUNCE_MS = 300

/** List items without Tab-to-nest: RichDoc has no nested lists, and Tab keeps moving focus. */
const FlatListItem = ListItem.extend({
  addKeyboardShortcuts() {
    return {
      Enter: () => this.editor.commands.splitListItem(this.name),
      'Shift-Tab': () => this.editor.commands.liftListItem(this.name),
    }
  },
})

/** Paragraphs, bold, italic and bullet lists only (spec §4.5). Default Tiptap shortcuts. */
const BASE_EXTENSIONS = [
  StarterKit.configure({
    heading: false,
    blockquote: false,
    code: false,
    codeBlock: false,
    horizontalRule: false,
    hardBreak: false,
    strike: false,
    underline: false,
    link: false,
    orderedList: false,
    trailingNode: false,
    listItem: false,
  }),
  FlatListItem,
  BlockAuthorship,
]

export type RichEditorProps = {
  doc: RichDoc
  /** Called with the edited doc, debounced 300 ms (flushed on blur and unmount). */
  onChange(doc: RichDoc): void
  editable: boolean
  /** Muted text shown while the editor is empty. Read once, when the editor is created. */
  placeholder?: string
  /** Focus the end of the doc (and scroll to it) once the editor exists. */
  autoFocus?: boolean
  onBlur?(): void
  /** Accessible name of the text box, e.g. the section label. */
  ariaLabel?: string
  className?: string
}

const setExternal = (editor: Editor, doc: RichDoc) =>
  editor.chain().setMeta(EXTERNAL_META, true).setContent(toEditorDoc(doc), { emitUpdate: false }).run()

/**
 * A Tiptap editor bound to a RichDoc (no toolbar; ⌘B, ⌘I, "- " for lists).
 *
 * Sync with the store:
 * - `synced` is the doc both sides last agreed on: the last doc emitted or applied.
 * - A `doc` prop equal to `synced` is our own echo and is ignored.
 * - Any other `doc` is external. Unfocused, it replaces the content at once (meta
 *   `external`, so authorship isn't touched). Focused, it waits in `pending` until blur, and
 *   local edits stop being emitted so they can't overwrite it in the store.
 * - On blur or unmount, pending external changes are three-way merged with the local edits
 *   (`mergeDocs`), and the merge goes to both the editor and `onChange`.
 */
export function RichEditor({
  doc,
  onChange,
  editable,
  placeholder,
  autoFocus,
  onBlur,
  ariaLabel,
  className,
}: RichEditorProps) {
  const onChangeRef = useRef(onChange)
  const onBlurRef = useRef(onBlur)
  useEffect(() => {
    onChangeRef.current = onChange
    onBlurRef.current = onBlur
  })

  const synced = useRef<RichDoc>(doc)
  const pending = useRef<RichDoc | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const emit = (editor: Editor) => {
    const local = fromEditorDoc(editor.getJSON())
    if (docKey(local) === docKey(synced.current)) return
    synced.current = local
    onChangeRef.current(local)
  }

  /** Emits what's waiting, merging in a deferred external doc. `apply`: also update the editor. */
  const flush = (editor: Editor, apply: boolean) => {
    const hadTimer = timer.current !== null
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const external = pending.current
    pending.current = null
    if (!external) {
      if (hadTimer) emit(editor)
      return
    }
    const local = fromEditorDoc(editor.getJSON())
    const merged = mergeDocs(synced.current, local, external)
    synced.current = merged
    if (apply && docKey(merged) !== docKey(local)) setExternal(editor, merged)
    if (docKey(merged) !== docKey(external)) onChangeRef.current(merged)
  }

  // Created once: useEditor compares options on every render and would re-apply new objects.
  const [initial] = useState(() => ({
    content: toEditorDoc(doc),
    extensions: placeholder ? [...BASE_EXTENSIONS, Placeholder.configure({ placeholder })] : BASE_EXTENSIONS,
  }))
  const editorProps = useMemo(
    () => ({
      attributes: {
        class: cn(
          'min-h-[1.65em] outline-none [&_p]:m-0 [&_ul]:m-0 [&_ul]:list-disc [&_ul]:pl-5 [&_strong]:font-semibold',
          className,
        ),
        ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
      },
    }),
    [className, ariaLabel],
  )

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editable,
    extensions: initial.extensions,
    content: initial.content,
    editorProps,
    onUpdate: ({ editor, transaction }) => {
      if (transaction.getMeta(EXTERNAL_META) || pending.current) return
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        timer.current = null
        emit(editor)
      }, DEBOUNCE_MS)
    },
    onBlur: ({ editor }) => {
      flush(editor, true)
      onBlurRef.current?.()
    },
  })

  // Store → editor.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    if (docKey(doc) === docKey(synced.current)) {
      pending.current = null
      return
    }
    if (editor.isFocused) {
      pending.current = doc
      if (timer.current) clearTimeout(timer.current)
      timer.current = null
      return
    }
    synced.current = doc
    setExternal(editor, doc)
  }, [doc, editor])

  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.setEditable(editable, false)
  }, [editor, editable])

  useEffect(() => {
    if (!editor || !autoFocus) return
    editor.commands.focus('end')
    editor.view.dom.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [editor, autoFocus])

  // Tab switches unmount the editor: don't lose the last 300 ms of typing.
  useEffect(() => {
    if (!editor) return
    return () => flush(editor, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- flush only reads refs
  }, [editor])

  return <EditorContent editor={editor} />
}
