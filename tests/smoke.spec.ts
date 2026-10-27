import { test, expect, type Page } from 'playwright/test';

// End-to-end smoke net against `npm run preview` (dist/): first-run home setup,
// completing a chore earns points, data survives reload (IndexedDB), and task edit.

test.describe.configure({ mode: 'serial' });

test.describe('home lifecycle', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('first run shows home setup and creates rooms + member', async () => {
    await page.goto('/');
    const sheet = page.locator('.sheet');
    await expect(sheet.locator('h2')).toHaveText('Set up your home');

    // Defaults: kitchen, bedroom, bathroom, living, whole-home = 5. Add a second bathroom.
    await sheet.getByRole('button', { name: 'More Bathroom' }).click();
    await expect(sheet.getByLabel('Bathroom count')).toHaveText('2');
    await sheet.getByPlaceholder('e.g. Sam').fill('Sam');
    await sheet.getByRole('button', { name: 'Create 6 rooms' }).click();
    await expect(sheet).toBeHidden();

    await expect(page.locator('.hero-title')).toContainText('% clean');
  });

  test('rooms tab lists numbered bathrooms', async () => {
    await page.getByRole('button', { name: 'Rooms' }).click();
    await expect(page.locator('.room-card', { hasText: 'Bathroom 1' })).toBeVisible();
    await expect(page.locator('.room-card', { hasText: 'Bathroom 2' })).toBeVisible();
    await expect(page.locator('.room-card', { hasText: 'Kitchen' })).toBeVisible();
  });

  test('add a custom task via room sheet, due now', async () => {
    await page.locator('.room-card', { hasText: 'Kitchen' }).click();
    await page.getByRole('button', { name: 'Add task' }).click();
    const sheet = page.locator('.sheet').last();
    await expect(sheet.locator('h2')).toHaveText('New task');
    await sheet.getByPlaceholder('e.g. Clean toilet').fill('Descale kettle');
    await sheet.getByRole('button', { name: 'Big job · 20 pts' }).click();
    await sheet.getByLabel('Dirtiness').fill('120');
    await sheet.locator('.btn.save').first().click();
    await expect(page.locator('.sheet .task', { hasText: 'Descale kettle' })).toBeVisible();
    await page.locator('.sheet').getByRole('button', { name: 'Done', exact: true }).click();
  });

  test('complete it from Today → points on the leaderboard', async () => {
    await page.getByRole('button', { name: 'Today' }).click();
    const row = page.locator('.task', { hasText: 'Descale kettle' });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Mark Descale kettle done' }).click();
    await expect(page.locator('.toast')).toContainText('Descale kettle');
    await expect(page.locator('.section-label', { hasText: 'Overdue' }).locator('xpath=following-sibling::div[1]').locator('.task', { hasText: 'Descale kettle' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Scores' }).click();
    await expect(page.locator('.board-row', { hasText: 'Sam' }).locator('.pts')).toHaveText('20');
  });

  test('reload keeps everything (IndexedDB persistence)', async () => {
    await page.reload();
    await expect(page.locator('.sheet')).toHaveCount(0); // no setup again
    await page.getByRole('button', { name: 'Scores' }).click();
    await expect(page.locator('.board-row', { hasText: 'Sam' }).locator('.pts')).toHaveText('20');
    await expect(page.locator('.feed-row', { hasText: 'Descale kettle' })).toBeVisible();
  });
});
