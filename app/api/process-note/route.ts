import { z } from 'zod'
import type { AiContext } from '@/lib/ai/client'
import { fallbackOperations } from '@/lib/ai/fallback'
import { generateOperations } from '@/lib/ai/gemini'
import type { Operation } from '@/lib/report/operations'
import type { Note } from '@/lib/report/types'

const GapRefSchema = z.looseObject({
  id: z.string(),
  question: z.string(),
  target: z.looseObject({ kind: z.enum(['incident', 'section', 'report']) }),
})

const BodySchema = z.object({
  note: z.looseObject({
    id: z.string(),
    createdAt: z.iso.datetime(),
    text: z.string(),
    attachments: z.array(z.unknown()),
    status: z.enum(['pending', 'processed', 'failed']),
    routedTo: z.array(z.string()),
    replyTo: z.string().optional(),
    answersGapId: z.string().optional(),
  }),
  context: z.looseObject({
    shiftDate: z.string(),
    startHHMM: z.string(),
    nowHHMM: z.string(),
    noteHHMM: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    incidents: z.array(z.looseObject({ id: z.string(), number: z.number() })),
    sections: z.array(z.looseObject({ key: z.string(), text: z.string() })),
    openGaps: z.array(GapRefSchema),
    openQuestions: z.array(z.looseObject({ id: z.string(), question: z.string() })),
    answeringGap: GapRefSchema.optional(),
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

  const fallback = fallbackOperations(note, context)
  if (fallback) return Response.json({ operations: fallback, source: 'fallback' })
  return Response.json({ error: 'unprocessable' }, { status: 422 })
}
