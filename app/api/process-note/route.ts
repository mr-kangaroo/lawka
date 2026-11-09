import { z } from 'zod'
import type { AiContext } from '@/lib/ai/client'
import { fallbackOperations } from '@/lib/ai/fallback'
import { generateOperations } from '@/lib/ai/gemini'
import type { Operation } from '@/lib/report/operations'
import type { Note } from '@/lib/report/types'

/** The AI call is bounded at 20 s; leave headroom for the fallback. */
export const maxDuration = 30

/** Caps keep a public endpoint from forwarding huge prompts to the model. */
const NOTE_MAX = 4000
const TEXT_MAX = 8000
const ARRAY_MAX = 100
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
const short = z.string().max(NOTE_MAX)
const list = <T extends z.ZodType>(item: T) => z.array(item).max(ARRAY_MAX)

const GapRefSchema = z.looseObject({
  id: short,
  question: short,
  target: z.looseObject({ kind: z.enum(['incident', 'section', 'report']) }),
})

const BodySchema = z.object({
  note: z.looseObject({
    id: short,
    createdAt: z.iso.datetime(),
    text: z.string().max(NOTE_MAX),
    attachments: list(z.unknown()),
    status: z.enum(['pending', 'processed', 'failed']),
    routedTo: list(z.looseObject({ kind: z.enum(['incident', 'section']) })),
    answersGapId: short.optional(),
  }),
  context: z.looseObject({
    shiftDate: short,
    startHHMM: short,
    nowHHMM: short,
    noteHHMM: z.string().regex(HHMM),
    incidents: list(z.looseObject({ id: short, number: z.number(), description: z.string().max(TEXT_MAX) })),
    sections: list(z.looseObject({ key: short, text: z.string().max(TEXT_MAX) })),
    openGaps: list(GapRefSchema),
    answeringGap: GapRefSchema.optional(),
    editing: z.looseObject({ previousText: z.string().max(NOTE_MAX), incidentIds: list(short) }).optional(),
  }),
})

/** Error type only: never the message, the prompt or the key. */
function errorType(err: unknown): string {
  if (!(err instanceof Error)) return typeof err
  const status = (err as { statusCode?: unknown }).statusCode
  return typeof status === 'number' ? `${err.name} ${status}` : err.name
}

export async function POST(request: Request): Promise<Response> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) return Response.json({ error: 'invalid_body' }, { status: 400 })
  // The loose schemas check the shape the route relies on; the client builds the full types.
  const note = parsed.data.note as unknown as Note
  const context = parsed.data.context as unknown as AiContext

  let operations: Operation[] | null = null
  try {
    // One retry for transient 503/429; the 20 s abort bounds the whole call including the retry.
    operations = await generateOperations(note, context, { signal: AbortSignal.timeout(20000), maxRetries: 1 })
  } catch (err) {
    console.warn(`[process-note] AI failed: ${errorType(err)}; trying fallback`)
  }
  if (operations) return Response.json({ operations, source: 'ai' })
  // The scripted fallback cannot tell an edit from a new note and would duplicate incidents.
  if (context.editing) return Response.json({ error: 'unprocessable' }, { status: 422 })

  const fallback = fallbackOperations(note, context)
  if (fallback) return Response.json({ operations: fallback, source: 'fallback' })
  return Response.json({ error: 'unprocessable' }, { status: 422 })
}
