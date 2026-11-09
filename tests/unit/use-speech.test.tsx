// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSpeech } from '@/components/composer/use-speech'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

class FakeRec {
  static instances: FakeRec[] = []
  lang = ''
  interimResults = false
  continuous = false
  onresult: ((e: unknown) => void) | null = null
  onerror: ((e: { error: string }) => void) | null = null
  onend: (() => void) | null = null
  aborted = false
  handlersAtAbort: [unknown, unknown, unknown] | null = null
  constructor() {
    FakeRec.instances.push(this)
  }
  start() {}
  stop() {}
  abort() {
    this.aborted = true
    this.handlersAtAbort = [this.onresult, this.onerror, this.onend]
  }
}

const result = (text: string, isFinal: boolean) => Object.assign([{ transcript: text }], { isFinal })

const box: { api: ReturnType<typeof useSpeech> } = { api: undefined as never }
let root: Root

function Probe({ onApi }: { onApi: (a: ReturnType<typeof useSpeech>) => void }) {
  const a = useSpeech()
  onApi(a)
  return null
}

beforeEach(() => {
  FakeRec.instances = []
  ;(window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRec
  const el = document.createElement('div')
  root = createRoot(el)
  act(() => root.render(<Probe onApi={(a) => Object.assign(box, { api: a })} />))
})
afterEach(() => {
  act(() => root.unmount())
  delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition
})

describe('useSpeech', () => {
  it('late onresult after cancel() does not call onText', () => {
    const onText = vi.fn()
    act(() => box.api.start({ base: 'a', onText }))
    const rec = FakeRec.instances[0]
    act(() => rec.onresult?.({ resultIndex: 0, results: [result('x', true)] }))
    expect(onText).toHaveBeenCalledWith('a x')
    onText.mockClear()
    act(() => box.api.cancel())
    expect(box.api.listening).toBe(false)
    expect(rec.aborted).toBe(true)
    act(() => rec.onresult?.({ resultIndex: 0, results: [result('y', true)] }))
    expect(rec.onresult).toBeNull()
    expect(onText).not.toHaveBeenCalled()
  })

  it('unmount detaches handlers before abort', () => {
    act(() => box.api.start({ base: '', onText: vi.fn() }))
    const rec = FakeRec.instances[0]
    act(() => root.unmount())
    expect(rec.aborted).toBe(true)
    expect(rec.handlersAtAbort).toEqual([null, null, null])
    root = createRoot(document.createElement('div')) // keep afterEach's unmount valid
  })

  it('old instance onend does not reset a new session', () => {
    act(() => box.api.start({ base: '', onText: vi.fn() }))
    const first = FakeRec.instances[0]
    act(() => box.api.stop())
    act(() => box.api.start({ base: '', onText: vi.fn() }))
    expect(box.api.listening).toBe(true)
    act(() => first.onend?.())
    expect(box.api.listening).toBe(true)
  })
})
