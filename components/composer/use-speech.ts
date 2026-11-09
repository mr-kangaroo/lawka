'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { mergeDictation } from '@/lib/dictation'

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } }
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> }
type Recognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type RecognitionCtor = new () => Recognition

function getCtor(): RecognitionCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export type StartOptions = {
  /** Textarea text from before dictation; recognised speech is appended to it. */
  base: string
  /** Receives the full text to show (base + final + interim). */
  onText: (text: string) => void
  /** Microphone permission was refused. */
  onDenied?: () => void
}

/**
 * Web Speech API wrapper (Polish). `supported` is false on the server and until mount, so the
 * server render never differs from the first client render. Stops on a second click, window
 * blur, unmount, error and end.
 */
export function useSpeech() {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const recRef = useRef<Recognition | null>(null)

  useEffect(() => {
    // Feature detection needs `window`; doing it after mount keeps SSR and hydration identical.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(Boolean(getCtor()))
  }, [])

  const stop = useCallback(() => {
    recRef.current?.stop()
    recRef.current = null
    setListening(false)
  }, [])

  const start = useCallback(
    ({ base, onText, onDenied }: StartOptions) => {
      const Ctor = getCtor()
      if (!Ctor || recRef.current) return
      const rec = new Ctor()
      rec.lang = 'pl-PL'
      rec.interimResults = true
      rec.continuous = true
      rec.onresult = (e) => {
        let finalText = ''
        let interim = ''
        for (let i = 0; i < e.results.length; i++) {
          const r = e.results[i]
          if (r.isFinal) finalText += `${r[0].transcript} `
          else interim += r[0].transcript
        }
        onText(mergeDictation(base, finalText, interim))
      }
      const finish = () => {
        if (recRef.current === rec) recRef.current = null
        setListening(false)
      }
      rec.onerror = (e) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') onDenied?.()
        finish()
      }
      rec.onend = finish
      recRef.current = rec
      try {
        rec.start()
        setListening(true)
      } catch {
        finish()
      }
    },
    [],
  )

  useEffect(() => {
    const onBlur = () => stop()
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('blur', onBlur)
      recRef.current?.abort()
      recRef.current = null
    }
  }, [stop])

  return { supported, listening, start, stop }
}
