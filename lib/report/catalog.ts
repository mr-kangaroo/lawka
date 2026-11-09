import type { SectionKey } from './types'

export const SECTION_LABELS: Record<SectionKey, string> = {
  summary: 'Podsumowanie',
  audience: 'Publiczność i bezpieczeństwo',
  security: 'Ochrona',
  maintenance: 'Usterki i sprzęt',
  doorStaff: 'Ocena bramkarzy',
  artists: 'Artyści i ekipa',
  production: 'Produkcja / przebieg / otwarcie drzwi',
  bar: 'Bar',
  kitchen: 'Kuchnia',
  suppliers: 'Dostawcy zewnętrzni',
  privateEvents: 'Imprezy prywatne',
  stock: 'Stany magazynowe',
}

// Incidents are rendered separately, between summary and audience.
export const FIXED_SECTIONS: SectionKey[] = ['summary', 'audience', 'security', 'maintenance']

export const CONDITIONAL_SECTIONS: SectionKey[] = [
  'doorStaff',
  'artists',
  'production',
  'bar',
  'kitchen',
  'suppliers',
  'privateEvents',
  'stock',
]

export const HINT_ORDER: SectionKey[] = [
  'bar',
  'doorStaff',
  'production',
  'stock',
  'artists',
  'kitchen',
  'suppliers',
  'privateEvents',
]

export const HINT_LABEL_OVERRIDES: Partial<Record<SectionKey, string>> = {
  production: 'Produkcja / przebieg',
}

export const EMPTY_SECTION_PROMPTS: Partial<Record<SectionKey, string>> = {
  security: 'Co z ochroną? Napisz w notatce albo potwierdź.',
  audience: 'Co z publicznością? Napisz w notatce albo potwierdź.',
  maintenance: 'Jakieś usterki? Napisz w notatce albo potwierdź.',
}

export const INCIDENT_TYPES: string[] = [
  'Bójka',
  'Agresja słowna',
  'Kradzież',
  'Zasłabnięcie / pomoc medyczna',
  'Nietrzeźwość',
  'Narkotyki',
  'Molestowanie',
  'Uszkodzenie mienia',
  'Odmowa wejścia',
  'Interwencja policji',
  'Inne',
]

export const VENUE_AREAS: string[] = [
  'Wejście / bramka',
  'Szatnia',
  'Bar główny',
  'Parkiet',
  'Loża VIP',
  'Toaleta damska',
  'Toaleta męska',
  'Palarnia',
  'Przed lokalem',
]

export const INCIDENT_FIELD_QUESTIONS = {
  type: 'Jaki typ zdarzenia?',
  location: 'Gdzie?',
  description: 'Opis zdarzenia?',
  time: 'Dokładna godzina?',
} as const
