/** Lowercase, strip diacritics (ł -> l). */
export function normalizeForSearch(s: string): string {
  return s
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

export function matches(query: string, label: string): boolean {
  return normalizeForSearch(label).includes(normalizeForSearch(query.trim()))
}
