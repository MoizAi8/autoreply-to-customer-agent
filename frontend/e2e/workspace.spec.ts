import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import path from 'node:path'

const apiUrl = process.env.QA_API_URL || 'http://127.0.0.1:8011/api/v1'
const evidence = path.resolve('../docs/screenshots')
const password = 'synthetic-browser-test-passphrase'

async function account(request: APIRequestContext) {
  const email = 'qa-' + Date.now() + '@example.com'
  const created = await request.post(apiUrl + '/auth/register', { data: { email, password, full_name: 'Taylor Reed', business_name: 'Harbor & Pine' } })
  expect(created.status(), await created.text()).toBe(201)
  return email
}

let workspaceEmail: string | undefined

async function browserAccount(request: APIRequestContext) {
  workspaceEmail ??= await account(request)
  return workspaceEmail
}

async function login(page: Page, email: string) {
  await page.goto('/login/')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Review overview' })).toBeVisible()
}

async function fit(page: Page) {
  const width = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: window.innerWidth }))
  expect(width.content).toBeLessThanOrEqual(width.viewport)
}

for (const viewport of [{ width: 1440, height: 960 }, { width: 820, height: 1100 }, { width: 390, height: 844 }]) {
  test('public sample is self-contained at ' + viewport.width + ' pixels', async ({ page }) => {
    await page.setViewportSize(viewport)
    const errors: string[] = []
    const apiCalls: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('request', (request) => { if (request.url().includes('/api/')) apiCalls.push(request.url()) })
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Give every review a thoughtful reply.')
    await fit(page)
    if (viewport.width === 1440) await page.screenshot({ path: path.join(evidence, 'landing.png'), fullPage: true })
    await page.getByRole('link', { name: 'Try sample workspace' }).click()
    await expect(page.getByRole('heading', { name: 'Sample workspace' })).toBeVisible()
    await page.getByRole('button', { name: /Casey R/ }).click()
    await page.getByLabel('Sample response').fill('Thank you for visiting our shop, Casey.')
    await page.getByRole('button', { name: 'Approve draft' }).click()
    await expect(page.getByRole('status')).toHaveText('Draft approved')
    await expect(page.getByRole('button', { name: /Casey R.*Approved/ })).toBeVisible()
    await fit(page)
    expect(apiCalls).toEqual([])
    expect(errors).toEqual([])
  })
}

test('anonymous sessions are redirected from the workspace', async ({ page }) => {
  await page.goto('/dashboard/')
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await expect(page).toHaveURL(/\/login\/?$/)
})

test('complete authenticated review workflow persists through reload', async ({ page, request }) => {
  const email = await browserAccount(request)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await login(page, email)
  await page.getByRole('link', { name: 'Open inbox' }).click()
  await page.getByRole('button', { name: 'Add review' }).click()
  await page.getByLabel('Reviewer').fill('Jordan Lee')
  await page.getByLabel('Title', { exact: true }).fill('A smooth pickup')
  await page.getByLabel('Review text').fill('The order was ready early and the staff helped me carry it.')
  await page.getByRole('button', { name: 'Save review' }).click()
  await expect(page.getByRole('link', { name: /Jordan Lee/ })).toBeVisible()
  await page.getByRole('button', { name: 'Import CSV' }).click()
  await page.getByLabel('CSV file').setInputFiles({ name: 'synthetic.csv', mimeType: 'text/csv', buffer: Buffer.from('rating,content,customer_name\n2,Delivery arrived late.,Avery Stone\n4,Support answered the same day.,Riley Kim\n7,Invalid rating,Invalid Example') })
  await page.getByRole('button', { name: 'Import reviews' }).click()
  await expect(page.getByRole('status')).toContainText('2 imported')
  await expect(page.getByRole('status')).toContainText('1 invalid rows')
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.getByRole('link', { name: /Avery Stone/ })).toBeVisible()
  await page.getByLabel('Rating', { exact: true }).selectOption('2')
  await expect(page.getByRole('link', { name: /Avery Stone/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Jordan Lee/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(page.getByRole('link', { name: /Jordan Lee/ })).toBeVisible()
  await fit(page)
  await page.screenshot({ path: path.join(evidence, 'review-inbox.png'), fullPage: true })
  await page.getByRole('link', { name: /Jordan Lee/ }).click()
  await expect(page.getByRole('heading', { name: 'A smooth pickup' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Response studio' })).toBeVisible()
  await page.screenshot({ path: path.join(evidence, 'review-detail.png'), fullPage: true })
  await page.getByRole('textbox', { name: 'Response', exact: true }).fill('Thank you, Jordan. We’re glad your pickup was ready early and that our team could help.')
  await page.getByRole('button', { name: 'Save draft' }).click()
  await expect(page.getByText('Draft saved.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Approve', exact: true }).click()
  await expect(page.getByText('Draft approved.', { exact: false }).first()).toBeVisible()
  await page.reload()
  await expect(page.getByText(/^approved$/i)).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Response', exact: true })).toHaveValue(/Thank you, Jordan/)
  await expect(page.getByRole('listitem').filter({ hasText: 'Draft approved' })).toBeVisible()
  await page.screenshot({ path: path.join(evidence, 'response-studio.png'), fullPage: true })
  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('link', { name: 'Overview' }).click()
  await expect(page.getByText('Approved drafts', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /Jordan Lee/ })).toBeVisible()
  await fit(page)
  await page.screenshot({ path: path.join(evidence, 'dashboard.png'), fullPage: true })
  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('link', { name: 'Analytics' }).click()
  await expect(page.getByRole('heading', { name: 'Feedback analytics' })).toBeVisible()
  await expect(page.getByText('33.3%', { exact: true })).toBeVisible()
  await page.getByLabel('Sentiment window').selectOption('7')
  await fit(page)
  await page.screenshot({ path: path.join(evidence, 'analytics.png'), fullPage: true })
  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('link', { name: 'Business profile' }).click()
  await page.getByLabel('Industry').fill('Specialty retail')
  await page.getByLabel('Business description').fill('Independent shop specializing in thoughtful home essentials.')
  await page.getByLabel('Public customer support contact').fill('support@example.com')
  await page.getByRole('button', { name: 'Save profile' }).click()
  await expect(page.getByText('Business profile saved.')).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Industry')).toHaveValue('Specialty retail')
  await page.screenshot({ path: path.join(evidence, 'business-profile.png'), fullPage: true })
  expect(errors).toEqual([])
})

for (const viewport of [{ width: 820, height: 1100 }, { width: 390, height: 844 }]) {
  test('signed-in workspace fits at ' + viewport.width + ' pixels', async ({ page, request }) => {
    await page.setViewportSize(viewport)
    await login(page, await browserAccount(request))
    await fit(page)
    await page.getByRole('button', { name: 'Open navigation' }).click()
    const dialog = page.getByRole('dialog', { name: 'Workspace navigation' })
    await expect(dialog).toBeVisible()
    if (viewport.width === 390) await page.screenshot({ path: path.join(evidence, 'mobile-navigation.png') })
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await page.getByRole('button', { name: 'Open navigation' }).click()
    await dialog.getByRole('link', { name: 'Review inbox' }).click()
    await expect(page.getByRole('heading', { name: 'Review inbox' })).toBeVisible()
    await fit(page)
    await page.getByRole('button', { name: 'Add review' }).click()
    await expect(page.getByRole('dialog', { name: 'Add a review' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save review' })).toBeVisible()
    await fit(page)
  })
}
