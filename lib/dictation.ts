/**
 * Merges what was in the textarea before dictation (`base`), the recognised final transcript and
 * the still-changing interim tail into the text to show. Joins with a single space unless `base`
 * is empty or already ends in whitespace; blank parts are skipped.
 */
export function mergeDictation(base: string, finalText: string, interimText: string): string {
  const spoken = [finalText.trim(), interimText.trim()].filter(Boolean).join(' ')
  if (!spoken) return base
  if (!base || /\s$/.test(base)) return base + spoken
  return `${base} ${spoken}`
}
