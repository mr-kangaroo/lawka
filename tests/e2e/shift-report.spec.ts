import { expect, test } from './fixtures'

test('full shift flow: journal, possible incident, report, undo, send', async ({ page }) => {
  const isPhone = test.info().project.name === 'Pixel 7'
  const journalTab = page.getByRole('tab', { name: isPhone ? 'Dziennik' : 'Dziennik zmiany' })
  const reportTab = page.getByRole('tab', { name: /^Raport/ })
  const incidents = page.getByRole('region', { name: /^Incydent #\d+$/ })

  await page.goto('/')
  await expect(reportTab).toBeVisible()

  // Demo loaded: 4 required gaps in the badge, no question card in the journal.
  await expect(reportTab).toHaveAccessibleName(/4 do uzupełnienia/)
  await expect(page.getByText('czeka na Twoją odpowiedź')).toHaveCount(0)

  // Add a note in Dziennik; the (mocked) AI files it as a new incident, numbered by event time.
  await journalTab.click()
  const note = page.getByRole('textbox', { name: 'Nowa notatka' })
  await note.fill('23:10 awantura na bramce')
  await note.press('Enter')
  await expect(page.getByText('Incydent #2', { exact: true })).toBeVisible()

  // Edit that note: Anuluj restores it, Zapisz saves the new text and files it again (no duplicate).
  await page.getByRole('button', { name: 'Edytuj notatkę: 23:10 awantura na bramce' }).click()
  const editBox = page.getByRole('textbox', { name: 'Edytuj notatkę' })
  await editBox.fill('23:15 awantura na bramce')
  await page.getByRole('button', { name: 'Anuluj' }).click()
  await expect(page.getByText('23:10 awantura na bramce')).toBeVisible()
  await page.getByRole('button', { name: 'Edytuj notatkę: 23:10 awantura na bramce' }).click()
  await editBox.fill('23:15 awantura na bramce')
  await page.getByRole('button', { name: 'Zapisz' }).click()
  await expect(page.getByText('23:15 awantura na bramce')).toBeVisible()
  await expect(page.getByText('Incydent #2', { exact: true })).toBeVisible()

  // Raport: 3 incidents plus the possible one from 01:48; confirming it makes it a 4th incident.
  await reportTab.click()
  await expect(incidents).toHaveCount(3)
  const possible = page.getByRole('region', { name: 'Możliwy incydent #4' })
  await possible.getByRole('button', { name: 'Tak, to incydent' }).click()
  await expect(incidents).toHaveCount(4)

  // Answer the police gap chip: it disappears.
  await page.getByRole('button', { name: 'Czy wezwano policję?' }).click()
  await page.getByRole('textbox', { name: 'Czy wezwano policję?' }).fill('Tak, policja przyjechała o 22:55')
  await page.getByRole('button', { name: 'Zapisz' }).click()
  await expect(page.getByRole('button', { name: 'Czy wezwano policję?' })).toHaveCount(0)

  // Ochrona: confirm "Bez uwag".
  const security = page.getByRole('region', { name: 'Ochrona' })
  await security.getByRole('button', { name: 'Bez uwag' }).click()
  await expect(security.getByText('Bez uwag.')).toBeVisible()

  // Duplicate, remove, undo.
  const menuOf = (n: number) => page.getByRole('button', { name: `Akcje incydentu #${n}` })
  await menuOf(1).click()
  await page.getByRole('menuitem', { name: 'Duplikuj' }).click()
  await expect(incidents).toHaveCount(5)

  await menuOf(1).click()
  await page.getByRole('menuitem', { name: 'Usuń' }).click()
  await expect(incidents).toHaveCount(4)
  await page.getByRole('button', { name: 'Cofnij' }).click()
  await expect(incidents).toHaveCount(5)

  // Send with a gap left open: review dialog, send anyway, read-only report.
  await page.getByRole('button', { name: 'Wyślij raport' }).click()
  await page.getByRole('button', { name: 'Wyślij mimo to' }).click()
  await expect(page.getByText(/^Wysłano/)).toBeVisible()
  await expect(page.getByText('brak danych').first()).toBeVisible()

  // New shift: the journal starts with the centred empty state, and the first note replaces it.
  await page.getByRole('tab', { name: /Dziennik/ }).click()
  await page.getByRole('button', { name: 'Nowa zmiana' }).first().click()
  await expect(page.getByRole('heading', { name: 'Zapisuj, co dzieje się na zmianie' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Zobacz raport' }).first()).toBeVisible()
  await page.getByRole('textbox').fill('22:00 pierwsza notatka')
  await page.keyboard.press('Enter')
  await expect(page.getByText('22:00 pierwsza notatka')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Zapisuj, co dzieje się na zmianie' })).toHaveCount(0)
})
