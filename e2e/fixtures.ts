import AxeBuilder from '@axe-core/playwright';
import { test as base, expect, type Page } from '@playwright/test';

export { expect };

/** Every spec fails on a console error or a 5xx, collected and asserted after the test. */
export const test = base.extend<{ problems: string[] }>({
  problems: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error') problems.push(`console: ${m.text()}`);
      });
      page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
      page.on('response', (r) => {
        if (r.status() >= 500) problems.push(`${r.status()} ${r.url()}`);
      });
      await use(problems);
      expect(problems, 'console errors or server errors').toEqual([]);
    },
    { auto: true },
  ],
});

/**
 * On web, screens under the current one stay in the page, so locators keep
 * to visible elements and take the newest match.
 */
export const button = (page: Page, name: string | RegExp) =>
  page.getByRole('button', { name, exact: typeof name === 'string' }).filter({ visible: true }).last();

export const field = (page: Page, label: string) => page.getByLabel(label, { exact: true }).filter({ visible: true }).last();

/** Let a screen transition finish before the next locator resolves. */
export const settle = (page: Page, ms = 600) => page.waitForTimeout(ms);

export async function openApp(page: Page, opts: { demo?: boolean } = {}) {
  await page.goto(opts.demo ? '/?demo=1' : '/');
  // Seeding the sample notes takes a few seconds when four browsers run at once.
  await expect(page.getByRole('heading', { name: 'Pocketleaf' }).filter({ visible: true })).toBeVisible({ timeout: 20_000 });
  if (opts.demo) await expect(page.getByText('Groceries').first()).toBeVisible({ timeout: 10_000 });
}

export async function newNote(page: Page, kind: 'Note' | 'List') {
  await button(page, 'New').click();
  await button(page, kind).click();
  await settle(page);
}

export async function back(page: Page) {
  await button(page, 'Back').click();
  await settle(page);
}

export async function openCard(page: Page, title: string) {
  await page
    .getByRole('button', { name: new RegExp(`^(Pinned\\., )?${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) })
    .filter({ visible: true })
    .last()
    .click();
  await settle(page);
}

/** axe scan: no serious or critical violations. Returns the rest for the report. */
export async function expectAccessible(page: Page, screen: string) {
  // axe-core/playwright is typed against playwright-core's Page, the same object at runtime.
  const r = await new AxeBuilder({ page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]['page'] }).analyze();
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const summary = bad.map((v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes[0]?.target.join(' ')}`);
  expect(summary, `axe on ${screen}`).toEqual([]);
  return r.violations.filter((v) => !bad.includes(v));
}
