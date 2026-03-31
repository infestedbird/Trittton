import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureFile = path.resolve(__dirname, '../fixtures/sample_courses.json')
const fixtureData = JSON.parse(fs.readFileSync(fixtureFile, 'utf-8'))

test.describe('Filtering', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API to serve fixture data directly (auto-load succeeds)
    await page.route('/api/courses', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtureData) })
    })
    await page.goto('/')
    // Wait for auto-load to complete
    await expect(page.getByTestId('course-card').first()).toBeVisible()
  })

  test('search by course code filters correctly', async ({ page }) => {
    await page.getByTestId('search-input').fill('CSE 12')
    await expect(page.getByTestId('course-card')).toHaveCount(1)
    await expect(page.getByTestId('result-count')).toHaveText('1 course')
  })

  test('search by instructor name filters correctly', async ({ page }) => {
    await page.getByTestId('search-input').fill('Sahay')
    await expect(page.getByTestId('course-card')).toHaveCount(1)
    await expect(page.getByText('ECE 15')).toBeVisible()
  })

  test('department sidebar click filters to that department', async ({ page }) => {
    await page.getByRole('button', { name: /^CSE/ }).click()
    await expect(page.getByTestId('course-card')).toHaveCount(2)
    await expect(page.getByTestId('result-count')).toHaveText('2 courses')
  })

  test('type dropdown filters courses with matching section types', async ({ page }) => {
    await page.getByTestId('type-filter').selectOption('LA')
    await expect(page.getByTestId('course-card')).toHaveCount(1)
    await expect(page.getByText('ECE 15')).toBeVisible()
  })

  test('availability dropdown filters correctly', async ({ page }) => {
    await page.getByTestId('avail-filter').selectOption('waitlist')
    await expect(page.getByTestId('course-card')).toHaveCount(1)
    await expect(page.getByText('CSE 30')).toBeVisible()
  })

  test('availability filter for full courses', async ({ page }) => {
    await page.getByTestId('avail-filter').selectOption('full')
    await expect(page.getByTestId('course-card')).toHaveCount(1)
    await expect(page.getByText('MATH 20C')).toBeVisible()
  })

  test('combining multiple filters works', async ({ page }) => {
    await page.getByRole('button', { name: /^MATH/ }).click()
    await page.getByTestId('search-input').fill('Linear')
    await expect(page.getByTestId('course-card')).toHaveCount(1)
    await expect(page.getByText('MATH 18')).toBeVisible()
  })

  test('no results shows empty state', async ({ page }) => {
    await page.getByTestId('search-input').fill('NONEXISTENT_COURSE_XYZ')
    await expect(page.getByText('No courses found')).toBeVisible()
    await expect(page.getByTestId('result-count')).toHaveText('0 courses')
  })

  test('clearing filters restores full list', async ({ page }) => {
    await page.getByTestId('search-input').fill('CSE')
    await expect(page.getByTestId('course-card')).toHaveCount(2)

    await page.getByTestId('search-input').fill('')
    await expect(page.getByTestId('course-card')).toHaveCount(5)
  })
})
