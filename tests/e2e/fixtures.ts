import { test as base, expect, type Page } from '@playwright/test'

type Operation = Record<string, unknown>

/** Fixed model output per note, so the e2e never depends on the real AI. */
function operationsFor(body: { note: { text: string; replyTo?: string; answersGapId?: string } }): Operation[] {
  const { text, replyTo, answersGapId } = body.note
  if (answersGapId) return [{ op: 'resolveGap', gapId: answersGapId }]
  if (replyTo) return []
  if (/awantura/i.test(text)) {
    return [
      {
        op: 'addIncident',
        type: 'Bójka',
        time: { hhmm: '23:10', approx: false },
        location: 'Wejście / bramka',
        description: 'Awantura przy bramce, ochrona interweniowała.',
      },
    ]
  }
  return []
}

async function mockProcessNote(page: Page) {
  await page.route('**/api/process-note', async (route) => {
    const body = route.request().postDataJSON()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ operations: operationsFor(body), source: 'ai' }),
    })
  })
}

/** Each test gets a fresh context (empty localStorage, so the demo shift seeds) and the AI route mocked. */
export const test = base.extend({
  page: async ({ page }, use) => {
    await mockProcessNote(page)
    await use(page)
  },
})

export { expect }
