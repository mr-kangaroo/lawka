'use client'

import { useSyncExternalStore } from 'react'
import { useShift } from './shift'

const subscribe = (onChange: () => void) => useShift.persist.onFinishHydration(onChange)
const getSnapshot = () => useShift.persist.hasHydrated()
const getServerSnapshot = () => false

/**
 * True once the persisted shift has been read from localStorage.
 * The server and the first client render both see `false`, so nothing that depends on
 * persisted state is server-rendered and there is no hydration mismatch.
 */
export function useHasHydrated(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
