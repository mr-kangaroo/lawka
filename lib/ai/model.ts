/**
 * The one place the Gemini model id lives (spec §6.4). Chosen with `scripts/measure-models.ts` on 2026-11-09:
 * gemini-3.1-flash-lite parsed all three test notes in ~1.6–2.0 s with factual Polish; gemini-3.5-flash-lite was
 * as fast but invented a cause in the summary; gemini-3.8-flash returned 503 / timed out (high demand).
 */
export const MODEL_ID = 'gemini-3.1-flash-lite'
