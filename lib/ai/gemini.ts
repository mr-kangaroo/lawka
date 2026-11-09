import { google } from '@ai-sdk/google'
import { generateText, Output } from 'ai'
import type { AiContext } from '@/lib/ai/client'
import { MODEL_ID } from '@/lib/ai/model'
import { buildSystemPrompt, buildUserPrompt } from '@/lib/ai/prompt'
import { OperationsResponseSchema, type Operation } from '@/lib/report/operations'
import type { Note } from '@/lib/report/types'

/**
 * Server-only Gemini call (used by the API route and scripts/measure-models.ts).
 * The provider reads GOOGLE_GENERATIVE_AI_API_KEY from the environment.
 * Throws on any API, timeout or schema error; the caller decides on the fallback.
 */
export async function generateOperations(
  note: Note,
  context: AiContext,
  opts: { modelId?: string; signal?: AbortSignal; maxRetries?: number } = {},
): Promise<Operation[]> {
  const { output } = await generateText({
    model: google(opts.modelId ?? MODEL_ID),
    instructions: buildSystemPrompt(),
    prompt: buildUserPrompt(note, context),
    output: Output.object({ schema: OperationsResponseSchema }),
    abortSignal: opts.signal,
    maxRetries: opts.maxRetries ?? 0,
  })
  return output.operations
}
