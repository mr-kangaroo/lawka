export type IdGen = () => string

/** With a prefix: deterministic counter ids ("n-1", "n-2", ...) for tests. Without: crypto.randomUUID. */
export function createIdGen(prefix?: string): IdGen {
  if (prefix === undefined) return () => crypto.randomUUID()
  let n = 0
  return () => `${prefix}-${++n}`
}
