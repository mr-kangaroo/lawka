'use client' // Error boundaries must be Client Components

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

/** The store's persist key (store/shift.ts). */
const STORAGE_KEY = 'lawka:v1'

/**
 * Last-resort screen for an unexpected render error (for example, saved data the app can't
 * read). "Załaduj demo" drops the saved shift and reloads, so the app starts from the demo.
 */
export default function ErrorPage({ error }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  function loadDemo() {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Storage blocked: the reload still tries again.
    }
    window.location.reload()
  }

  return (
    <main className="grid h-dvh place-items-center bg-background px-4">
      <div role="alert" className="flex max-w-sm flex-col items-center gap-4 text-center">
        <p className="text-[15px] text-foreground">Coś poszło nie tak.</p>
        <Button onClick={loadDemo}>Załaduj demo</Button>
      </div>
    </main>
  )
}
