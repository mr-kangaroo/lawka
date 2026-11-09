import type { DerivedGap } from './gaps'

export type JumpTarget = {
  /** Id of the element to scroll to. */
  elementId: string
  /** CSS selector, relative to that element, of what to focus; the element itself when absent. */
  focus?: string
}

const FIELD_FOCUS: Record<string, string> = {
  type: 'button[aria-label^="Typ zdarzenia"]',
  time: 'button[aria-label^="Godzina zdarzenia"]',
  location: 'button[aria-label^="Miejsce"]',
  description: '[contenteditable="true"]',
}

/** Where "jump to this gap" goes in the Raport tab (spec §4.7). */
export function jumpTargetFor(target: DerivedGap['target']): JumpTarget {
  switch (target.kind) {
    case 'incident':
      return {
        elementId: `incident-${target.incidentId}`,
        // Without a field: an unconfirmed incident's "Tak" button, otherwise the incident itself.
        focus: target.field ? FIELD_FOCUS[target.field] : '[data-gap-focus="suspected"]',
      }
    case 'section':
      return { elementId: `section-${target.key}`, focus: '[contenteditable="true"], button' }
    case 'report':
      // The only report-level gap is "Potwierdź: brak incydentów"; focus the "Brak zdarzeń" button.
      return { elementId: 'incidents', focus: '[data-gap-focus="no-incidents"]' }
  }
}
