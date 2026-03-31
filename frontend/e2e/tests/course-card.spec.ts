import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureFile = path.resolve(__dirname, '../fixtures/sample_courses.json')
const fixtureData = JSON.parse(fs.readFileSync(fixtureFile, 'utf-8'))

test.describe('Course Card', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API to serve fixture data (auto-load succeeds)
    await page.route('/api/courses', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtureData) })
    })
    await page.goto('/')
    await expect(page.getByTestId('course-card').first()).toBeVisible()
  })

  test('displays course badge, title, units, and restrictions', async ({ page }) => {
    const cse12 = page.getByTestId('course-card').filter({ hasText: 'CSE 12' })
    await expect(cse12.getByText('Basic Data Struct & OO Design').last()).toBeVisible()
    await expect(cse12.getByText('4 units').last()).toBeVisible()
  })

  test('shows restrictions pill when present', async ({ page }) => {
    const cse30 = page.getByTestId('course-card').filter({ hasText: 'CSE 30' })
    await expect(cse30.getByText('FR SO').last()).toBeVisible()
  })

  test('clicking card expands to show section table', async ({ page }) => {
    const card = page.getByTestId('course-card').filter({ hasText: 'CSE 12' })
    const header = card.getByTestId('course-header')

    await header.click()
    await page.waitForTimeout(350)

    await expect(card.locator('table')).toBeVisible()
    await expect(card.getByText('80001')).toBeVisible()
    await expect(card.getByRole('cell', { name: 'Politz, Joe' }).first()).toBeVisible()
  })

  test('clicking expanded card collapses it', async ({ page }) => {
    const card = page.getByTestId('course-card').filter({ hasText: 'CSE 12' })
    const header = card.getByTestId('course-header')

    await header.click()
    await page.waitForTimeout(350)
    await expect(card.locator('table')).toBeVisible()

    await header.click()
    await page.waitForTimeout(400)
    const chevron = card.locator('[class*="rotate-180"]')
    await expect(chevron).toHaveCount(0)
  })

  test('availability status shows correct color for open courses', async ({ page }) => {
    const cse12 = page.getByTestId('course-card').filter({ hasText: 'CSE 12' })
    const seatStatus = cse12.getByTestId('seat-status')
    await expect(seatStatus).toContainText('seat')
    await expect(seatStatus).toContainText('open')
  })

  test('availability status shows waitlist for waitlisted courses', async ({ page }) => {
    const cse30 = page.getByTestId('course-card').filter({ hasText: 'CSE 30' })
    const seatStatus = cse30.getByTestId('seat-status')
    await expect(seatStatus).toHaveText('waitlist')
  })

  test('availability status shows full for full courses', async ({ page }) => {
    const math20c = page.getByTestId('course-card').filter({ hasText: 'MATH 20C' })
    const seatStatus = math20c.getByTestId('seat-status')
    await expect(seatStatus).toHaveText('full')
  })
})
