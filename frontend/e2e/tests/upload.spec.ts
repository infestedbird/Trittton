import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureFile = path.resolve(__dirname, '../fixtures/sample_courses.json')
const fixtureData = JSON.parse(fs.readFileSync(fixtureFile, 'utf-8'))

test.describe('File Upload', () => {
  test('shows scraping state when no data on server', async ({ page }) => {
    await page.route('/api/courses', (route) => {
      route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not found"}' })
    })
    await page.route('/api/scrape/start*', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"message":"started","total":5}' })
    })
    await page.route('/api/scrape/progress', (route) => {
      route.fulfill({ status: 200, contentType: 'text/event-stream', body: '' })
    })
    await page.goto('/')
    await expect(page.getByText('Scraping UCSD Courses...')).toBeVisible({ timeout: 5000 })
  })

  test('auto-loads data from server and shows courses', async ({ page }) => {
    // Mock server to return fixture data
    await page.route('/api/courses', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtureData) })
    })
    await page.goto('/')

    // Should auto-load and show courses
    await expect(page.getByTestId('course-card').first()).toBeVisible({ timeout: 5000 })

    // Stats in header
    const header = page.getByRole('banner')
    await expect(header.getByText('courses')).toBeVisible()
    await expect(header.getByText('sections')).toBeVisible()

    // Sidebar departments
    await expect(page.getByRole('button', { name: /All Departments/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^CSE\s/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^ECE\s/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^MATH\s/ })).toBeVisible()

    // Course cards
    await expect(page.getByTestId('course-card')).toHaveCount(5)
  })

  test('shows result count after auto-loading', async ({ page }) => {
    await page.route('/api/courses', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtureData) })
    })
    await page.goto('/')
    await expect(page.getByTestId('result-count')).toHaveText('5 courses')
  })
})
