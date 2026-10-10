import { expect, test, type Page } from '@playwright/test';

const notice = '数据均为非真实业务数据，仅用于交互功能演示。';
const productSection = (page: Page) => page.getByRole('region', { name: 'Top Products · Demo' });
const creativeSection = (page: Page) => page.getByRole('region', { name: 'Top Creatives · Demo' });
const searchSection = (page: Page) => page.getByRole('region', { name: 'Top Searches · Demo' });
const heatSection = (page: Page) => page.getByRole('region', { name: 'SEA Trend Dashboard' });
async function expectEnglish(page: Page) {
  const ui = await page.evaluate(() => {
    const content = document.body.innerText;
    const labels = [...document.querySelectorAll('[title], [aria-label], img[alt]')]
      .map(el => ['title', 'aria-label', 'alt'].map(attr => el.getAttribute(attr) || '').join(' ')).join(' ');
    return content + labels;
  });
  expect(ui.replaceAll(notice, '')).not.toMatch(/[\u3400-\u9fff]/);
}
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(heatSection(page).locator('tbody tr')).toHaveCount(20);
});

test('English UI has a prominent Chinese notice and no business API or logo', async ({ page }) => {
  const requests: string[] = [], errors: string[] = [];
  page.on('request', request => requests.push(request.url()));
  page.on('pageerror', error => errors.push(error.message));
  await page.reload();
  await expect(page.getByLabel('Demo data notice')).toContainText(notice);
  expect(await page.locator('.demo-notice p').evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(20);
  await expect(productSection(page).locator('article')).toHaveCount(100);
  await expectEnglish(page);
  await page.getByRole('button', { name: 'Creatives', exact: true }).click();
  await expect(creativeSection(page).locator('article')).toHaveCount(100);
  await expectEnglish(page);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(searchSection(page).locator('tbody tr')).toHaveCount(100);
  await expectEnglish(page);
  expect(requests.filter(url => /larkoffice|\/aeolus\/|play_auth_token|GetPlayInfo|ibyteimg|tiktokcdn|tiktok-row/i.test(url))).toEqual([]);
  expect(errors).toEqual([]);
  await expect(page.locator('img[alt="TikTok for Business"],img[src*="tt4b"]')).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('original calendar and climate remain interactive in both Gantt modes', async ({ page }) => {
  const calendar = page.getByRole('region', { name: 'SEA Marketing Calendar' });
  await calendar.getByRole('button', { name: /flag VN$/ }).click();
  await calendar.getByRole('button', { name: 'Jan.', exact: true }).first().click();
  const climate = calendar.locator('[data-climate="VN"]');
  await expect(climate).toContainText('14.6-20.0');
  await expect(climate).toContainText('28mm');
  await expect(climate).toContainText('Dry season');
  await expect(heatSection(page)).toContainText('Jan.／Jan 2026');
  await expect(productSection(page)).toContainText('SEA · 600');
  for (const code of ['MY', 'TH', 'SG', 'PH', 'ID']) {
    await calendar.getByRole('button', { name: new RegExp(`flag ${code}$`) }).click();
    await expect(calendar.locator(`[data-climate="${code}"]`)).toBeVisible();
  }
  await calendar.getByRole('button', { name: 'By country', exact: true }).click();
  await expect(calendar.locator('[data-seasonal-row="ID"]')).toBeVisible();
  await expectEnglish(page);
  await calendar.getByRole('button', { name: /ASEAN flag SEA$/ }).click();
  await expect(calendar.locator('[data-festival="new_year"]')).toHaveAttribute('title', /2026-01-01/);
});

test('fictional category filters, sorting, pagination and seven-market trends work', async ({ page }) => {
  const heat = heatSection(page);
  const initial = await heat.locator('tbody tr').first().innerText();
  await heat.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(heat).toContainText('Page 2 /');
  await heat.getByRole('button', { name: 'Demo scale descending', exact: true }).click();
  await expect(heat).toContainText('Page 1 /');
  expect(await heat.locator('tbody tr').first().innerText()).not.toBe(initial);
  await heat.getByRole('combobox', { name: 'CBEC L1', exact: true }).click();
  await page.getByRole('option', { name: 'Aster Market', exact: true }).click();
  expect(await heat.locator('tbody tr td:first-child').allTextContents()).toEqual(Array(20).fill('Aster Market'));
  await heat.getByRole('button', { name: 'Reset', exact: true }).click();
  const trigger = heat.getByRole('button', { name: 'View TGI trend', exact: true }).first();
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'TGI Trend', exact: true });
  await expect(dialog).toContainText(notice);
  await expect(dialog.locator('.recharts-line-curve')).toHaveCount(7);
  await expect.poll(() => dialog.locator('.recharts-line-curve').evaluateAll(paths =>
    paths.every(path => !path.getAttribute('stroke-dasharray')))).toBe(true);
  await expectEnglish(page);
  await page.screenshot({ path: 'docs/screenshots/trend-overlay.png', animations: 'disabled' });
  await dialog.getByRole('button', { name: /flag MY$/ }).click();
  await expect(dialog.locator('.recharts-line-curve')).toHaveCount(6);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('ranking, price band details and bubble controls retain their drill-downs', async ({ page }) => {
  const ranking = page.getByRole('region', { name: 'Top Trending Categories' });
  await ranking.getByRole('button', { name: / TGI trend$/ }).first().click();
  await expect(page.getByRole('dialog', { name: 'TGI Trend', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  const price = page.getByRole('region', { name: 'Trend Price Distribution' });
  await price.locator('.recharts-yAxis text').filter({ hasText: '$2~5' }).click();
  const detail = page.locator('[data-band-detail]');
  await expect(detail).toContainText(notice);
  await expect(detail.locator('li').first()).toBeVisible();
  await expectEnglish(page);
  await page.keyboard.press('Escape');
  const bubble = page.getByRole('region', { name: 'Trend Opportunity Matrix' });
  await bubble.getByRole('slider').focus();
  await page.keyboard.press('End');
  await expect(bubble.getByRole('slider')).toHaveValue('50');
  await expect(bubble.locator('.recharts-scatter-symbol circle')).toHaveCount(50);
  await bubble.locator('.recharts-scatter-symbol').first().click();
  await expect(page.getByRole('dialog', { name: 'TGI Trend', exact: true })).toBeVisible();
});

test('product search, page sizes, AI image zoom and local detail link work', async ({ page, context }) => {
  const products = productSection(page);
  await products.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(products).toContainText('Page 2 / 6');
  await products.getByRole('combobox', { name: 'Items per page' }).click();
  await page.getByRole('option', { name: '200 items', exact: true }).click();
  await expect(products.locator('article')).toHaveCount(200);
  await products.getByRole('searchbox').fill('demo concept');
  const names = await products.locator('article a').allTextContents();
  expect(names.length).toBeGreaterThan(0);
  expect(names.every(name => /Demo/.test(name) && /Concept/.test(name))).toBe(true);
  await products.getByRole('searchbox').fill('zzzz-no-demo-product');
  await expect(products).toContainText('No product matches all keywords');
  await products.getByRole('button', { name: 'Reset', exact: true }).click();
  await products.getByTitle('Enlarge image', { exact: true }).first().click();
  await expect(page.getByRole('dialog', { name: 'Product image preview' })).toContainText(notice);
  await expect(page.locator('[data-image-lightbox] img')).toHaveAttribute('src', /text_to_image/);
  await page.keyboard.press('Escape');
  const nextTab = context.waitForEvent('page');
  await products.locator('article a').first().click();
  const details = await nextTab;
  await expect(details.getByRole('heading', { name: 'Demo product details' })).toBeVisible();
  await expect(details.getByText(notice, { exact: true })).toBeVisible();
  await expectEnglish(details);
  await details.close();
});

test('creative filters persist and open the local player with an AI cover', async ({ page }) => {
  await page.getByRole('button', { name: 'Creatives', exact: true }).click();
  const creatives = creativeSection(page);
  await creatives.getByRole('combobox', { name: 'Country', exact: true }).click();
  await page.getByRole('option', { name: /flag TH$/ }).click();
  await expect(creatives).toContainText('TH · 100');
  await page.getByRole('button', { name: 'Products', exact: true }).click();
  await page.getByRole('button', { name: 'Creatives', exact: true }).click();
  await expect(creatives).toContainText('TH · 100');
  const first = creatives.locator('article').first();
  for (const metric of ['Demo duration', '3s retention', '50% retention', '75% retention', 'Completion', 'CTR', 'CVR']) {
    await expect(first).toContainText(metric);
  }
  await expect(first.getByTitle('Preview creative')).toBeVisible();
  await expect(first.locator('img')).toHaveAttribute('src', /text_to_image/);
  const detailsUrl = await first.locator('a').getAttribute('href');
  expect(detailsUrl).toMatch(/^(?:\.\/|\/)?\?demoMaterial=demo-material-\d+$/);
  await first.getByTitle('Preview creative', { exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Creative preview', exact: true });
  await expect(dialog).toContainText(notice);
  await expect(dialog.locator('iframe')).toHaveAttribute('src', /^(?:\.\/|\/)?\?demoPlayer=demo-material-\d+$/);
  await expect(dialog.getByRole('link', { name: 'Open demo details' })).toHaveAttribute('href', detailsUrl!);
  const player = page.frameLocator('iframe[title="Demo creative player"]');
  await player.getByRole('button', { name: 'Play demo', exact: true }).click();
  await expect(player.getByLabel('Playback time')).not.toHaveText('0.0 / 12s');
  await player.getByRole('button', { name: 'Pause demo', exact: true }).click();
  await player.getByRole('slider', { name: 'Demo playback progress' }).fill('8');
  await expect(player.getByLabel('Playback time')).toHaveText('8.0 / 12s');
  await expectEnglish(page);
  await dialog.getByRole('button', { name: 'Close creative preview', exact: true }).last().click();
  await expect(dialog).toHaveCount(0);
});

test('country Top 100 search terms filter locally and preserve view state', async ({ page }) => {
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  const searches = searchSection(page);
  await expect(searches).toContainText('MY · 100 terms');
  await expect(searches.locator('tbody tr')).toHaveCount(100);
  await searches.getByRole('button', { name: /Thailand flag TH$/ }).click();
  await expect(searches).toContainText('TH · 100 terms');
  await expect(searches.locator('tbody tr')).toHaveCount(100);

  const firstTerm = (await searches.locator('tbody tr').first().locator('td').nth(1).innerText()).toLowerCase();
  const keyword = firstTerm.split(' ')[0];
  await searches.getByRole('searchbox', { name: 'Search hot term' }).fill(keyword);
  const filteredCount = await searches.locator('tbody tr').count();
  expect(filteredCount).toBeGreaterThan(0);
  expect(filteredCount).toBeLessThan(100);

  await page.getByRole('button', { name: 'Products', exact: true }).click();
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(searches.getByRole('searchbox', { name: 'Search hot term' })).toHaveValue(keyword);
  await expect(searches).toContainText(`TH · ${filteredCount} terms`);
  await searches.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(searches).toContainText('MY · 100 terms');
  await expect(searches.locator('tbody tr')).toHaveCount(100);
  await page.screenshot({ path: 'docs/screenshots/search.png', animations: 'disabled' });
});

test('search table remains contained on a 320px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(searchSection(page).locator('tbody tr')).toHaveCount(100);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.screenshot({ path: 'docs/screenshots/search-mobile.png', animations: 'disabled' });
});

test('theme choice persists after reload', async ({ page }) => {
  await page.getByTitle('Switch to light mode').click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('failed media loads have an English state and preserve preview controls', async ({ page }) => {
  await page.route('https://copilot-cn.bytedance.net/**', route => route.abort());
  await page.reload();
  const products = productSection(page);
  await products.locator('article').first().scrollIntoViewIfNeeded();
  await expect(products.locator('article').first()).toContainText('AI image unavailable');
  await products.getByTitle('Enlarge image', { exact: true }).first().click();
  await expect(page.getByRole('dialog', { name: 'Product image preview' })).toContainText('AI image unavailable');
  await page.keyboard.press('Escape');
});

for (const width of [320, 375, 768, 1024, 1440, 1920]) {
  test(`English layout fits ${width}px in both themes`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ['light', 'dark']) {
      await page.getByTitle(`Switch to ${theme} mode`).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await expect(page.getByLabel('Demo data notice')).toBeVisible();
    }
    await page.screenshot({ path: `docs/screenshots/viewport-${width}.png` });
  });
}
