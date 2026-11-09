/**
 * Measures candidate Gemini models on messy Polish notes with the real prompt and schema.
 * Run: npx tsx --env-file=.env.local scripts/measure-models.ts [modelId ...]
 * Prints latency, whether the schema parsed, and the operations; never prints the key or the prompt.
 */
import { buildContext } from '@/lib/ai/client'
import { generateOperations } from '@/lib/ai/gemini'
import { createDemoShift } from '@/lib/report/seed'
import type { Note } from '@/lib/report/types'

const DEFAULT_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']

const NOTES: Array<{ text: string; at: Date }> = [
  { text: '23:10 awantura na bramce, nie wpuściliśmy 3 os., jeden groził ochroniarzowi', at: new Date(2026, 10, 8, 23, 14) },
  { text: 'spokojnie, bar zamknięty 2:40, zabrakło limonek', at: new Date(2026, 10, 9, 2, 45) },
  { text: 'dj spóźnił się 20 min, sprzęt ok', at: new Date(2026, 10, 8, 22, 5) },
]

function errorInfo(err: unknown): string {
  if (!(err instanceof Error)) return typeof err
  const status = (err as { statusCode?: number }).statusCode
  const base = status ? `${err.name} (${status})` : err.name
  return `${base}: ${err.message.slice(0, 300)}`
}

async function main() {
  const models = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_MODELS
  const shift = createDemoShift()
  for (const modelId of models) {
    console.log(`\n=== ${modelId}`)
    for (const [i, n] of NOTES.entries()) {
      const note: Note = {
        id: `measure-${i}`, createdAt: n.at.toISOString(), text: n.text, attachments: [], status: 'pending', routedTo: [],
      }
      const context = buildContext(shift, note, n.at)
      let attempt = 0
      while (true) {
        attempt++
        const t0 = performance.now()
        try {
          const ops = await generateOperations(note, context, { modelId, signal: AbortSignal.timeout(30000) })
          const ms = Math.round(performance.now() - t0)
          console.log(`note ${i + 1}: ${ms} ms, parsed OK (attempt ${attempt})`)
          console.log(JSON.stringify(ops, null, 1))
          break
        } catch (err) {
          const ms = Math.round(performance.now() - t0)
          console.log(`note ${i + 1}: ${ms} ms, FAILED ${errorInfo(err)} (attempt ${attempt})`)
          const status = (err as { statusCode?: number }).statusCode
          const transient = status === 503 || status === 429 || (err instanceof Error && err.name === 'TimeoutError')
          if (attempt >= 2 || !transient) break
        }
      }
    }
  }
}

main()
