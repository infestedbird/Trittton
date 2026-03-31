import { test, expect } from '@playwright/test'

test.describe('Scrape Panel', () => {
  test('scrape button shows scraping state when auto-scrape starts', async ({ page }) => {
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
    // Header should show "Scraping..." button since auto-scrape started
    await expect(page.getByText('Scraping...')).toBeVisible({ timeout: 5000 })
  })

  test('auto-scrape shows inline progress when no data exists', async ({ page }) => {
    await page.route('/api/courses', (route) => {
      route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not found"}' })
    })
    await page.route('/api/scrape/start*', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"message":"started","total":5}' })
    })
    await page.route('/api/scrape/progress', (route) => {
      // Only send running events — don't finish, so the UI stays in scraping state
      const body = 'data: {"current":1,"total":5,"currentSubject":"CSE","coursesFound":10,"status":"running"}\n\n'
      route.fulfill({ status: 200, contentType: 'text/event-stream', body })
    })

    await page.goto('/')
    await expect(page.getByText('Scraping UCSD Courses...')).toBeVisible({ timeout: 5000 })
  })

  test('clicking scrape button when data loaded shows panel with completion', async ({ page }) => {
    await page.route('/api/courses', (route) => {
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([{
          subject: 'CSE', course_code: 'CSE 12', title: 'Test', units: '4', restrictions: '',
          sections: [{ section_id: '1', type: 'LE', section: 'A00', days: 'MWF', time: '9a', building: 'X', room: '1', instructor: 'A', available: '5', limit: '10', waitlisted: '' }]
        }])
      })
    })
    await page.route('/api/scrape/start*', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"message":"started","total":3}' })
    })
    await page.route('/api/scrape/progress', (route) => {
      route.fulfill({
        status: 200, contentType: 'text/event-stream',
        body: 'data: {"status":"done","current":3,"total":3,"coursesFound":10}\n\n'
      })
    })

    await page.goto('/')
    await expect(page.getByTestId('course-card')).toHaveCount(1)

    await page.getByRole('button', { name: /Scrape/ }).click()
    await expect(page.getByText('Scrape Complete')).toBeVisible({ timeout: 5000 })
  })
})
