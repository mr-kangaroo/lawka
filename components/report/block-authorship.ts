import { combineTransactionSteps, Extension, getChangedRanges } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

/** Block types that carry authorship attrs at the top level of the doc. */
export const AUTHORED_BLOCKS = ['paragraph', 'bulletList'] as const

/** Transaction meta: the content came from the store, not from the user typing. */
export const EXTERNAL_META = 'external'

const OWN_META = 'blockAuthorship'

/**
 * A manager block's `at` is refreshed at most this often. Tiptap v3 input rules ("- ", "**b**")
 * dispatch the typed text first and give up if another plugin changed the doc in response, so
 * re-stamping on every keystroke would cancel them. With this window the triggering keystroke
 * leaves the doc alone, and `at` stays accurate to a minute.
 */
const RESTAMP_MS = 60_000
const pluginKey = new PluginKey(OWN_META)

/**
 * Tracks who wrote each top-level block (spec §5, D9: stored, never shown).
 *
 * - Adds `by`, `at` and `sourceNoteIds` attrs to `paragraph` and `bulletList`. They're never
 *   rendered to the DOM. Paragraphs nested in list items get them too (a schema-level
 *   limitation of global attrs), but only top-level blocks are ever stamped or exported.
 * - Any doc-changing transaction from the user stamps the top-level blocks it touched with
 *   `by: 'manager', at: now` (a block already stamped within the last minute is left as is,
 *   see `RESTAMP_MS`). Transactions with meta `external: true` are left alone.
 */
export const BlockAuthorship = Extension.create({
  name: 'blockAuthorship',

  addGlobalAttributes() {
    return [
      {
        types: [...AUTHORED_BLOCKS],
        attributes: {
          by: { default: 'manager', rendered: false, keepOnSplit: true },
          at: { default: null, rendered: false, keepOnSplit: true },
          sourceNoteIds: { default: [], rendered: false, keepOnSplit: true },
        },
      },
    ]
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pluginKey,
        appendTransaction(transactions, oldState, newState) {
          if (transactions.some((tr) => tr.getMeta(EXTERNAL_META))) return null
          if (!transactions.some((tr) => tr.docChanged && !tr.getMeta(OWN_META))) return null

          const changes = getChangedRanges(combineTransactionSteps(oldState.doc, [...transactions]))
          if (!changes.length) return null

          const now = Date.now()
          const at = new Date(now).toISOString()
          const tr = newState.tr
          newState.doc.forEach((node, start) => {
            if (!(AUTHORED_BLOCKS as readonly string[]).includes(node.type.name)) return
            const end = start + node.nodeSize
            const touched = changes.some(({ newRange: { from, to } }) =>
              from === to ? from > start && from < end : from < end && to > start,
            )
            if (!touched) return
            const stampedAt = typeof node.attrs.at === 'string' ? Date.parse(node.attrs.at) : NaN
            const fresh = node.attrs.by === 'manager' && now - stampedAt < RESTAMP_MS
            if (fresh) return
            tr.setNodeAttribute(start, 'by', 'manager')
            tr.setNodeAttribute(start, 'at', at)
          })
          if (!tr.docChanged) return null
          return tr.setMeta(OWN_META, true)
        },
      }),
    ]
  },
})
