import { describe, expect, it } from 'vitest';
import { demoHistory, COUNTRY_CODES, demoMarketContext, demoTags, randomFor } from '../src/data/demo/history';
import { computePhases, PRICE_BANDS } from '../src/data/dataset';
import { demoProducts, demoMaterials } from '../src/data/demo/assets';
import { demoSearches } from '../src/data/demo/search';
import { buildCountryPeakRows, buildSeasonalPeakRows } from '../src/data/market';
import { createHash } from 'node:crypto';
import festivals from '../src/data/demo/festivals.json';
import climate from '../src/data/demo/climate.json';

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

describe('synthetic demonstration data', () => {
  it('is reproducible and varies by market', () => {
    const a = randomFor('same'), b = randomFor('same');
    expect(Array.from({ length: 50 }, () => a())).toEqual(Array.from({ length: 50 }, () => b()));
    const sea = demoHistory('SEA');
    expect(demoHistory('SEA')).toBe(sea);
    for (const country of COUNTRY_CODES.filter(c => c !== 'SEA')) {
      expect(demoHistory(country).categories[0].tgi).not.toEqual(sea.categories[0].tgi);
    }
  });
  it('keeps twelve months, valid price bands and consistent phases in every market', () => {
    for (const country of COUNTRY_CODES) {
      const dataset = demoHistory(country);
      expect(dataset.window).toHaveLength(12);
      expect(dataset.categories.length).toBeGreaterThan(200);
      expect(new Set(dataset.categories.map(c => c.key)).size).toBe(dataset.categories.length);
      for (const c of dataset.categories) {
        expect(c.tgi).toHaveLength(12);
        expect(c.phases).toEqual(computePhases(c.tgi));
        expect(c.tgi.reduce((a, b) => a + b) / 12).toBeCloseTo(100, 1);
        c.band.forEach(b => expect(b >= 0 && b < PRICE_BANDS.length).toBe(true));
        c.scale.forEach(s => expect(s >= 0 && s <= 1).toBe(true));
        expect(c.trend).toEqual(c.tgi.map(t => t > 120 && c.volumeOk));
      }
      for (let month = 0; month < 12; month++) {
        expect(dataset.categories.filter(c => c.trend[month]).length).toBeGreaterThan(50);
      }
    }
  });
  it('retains cross-year stocking and clearance interactions', () => {
    const phases = computePhases([160, 140, 90, 100, 100, 100, 100, 100, 100, 100, 100, 100]);
    expect(phases[10]).toBe('stock');
    expect(phases[11]).toBe('stock');
    expect(phases[2]).toBe('clear');
  });
  it('preserves the complete original calendar and climate values', () => {
    expect(digest(festivals)).toBe('f7ae7dbb554329e97ae25a97969b1974868e979b8fa2223bfafa3f9e10d43317');
    expect(digest(climate.map(row => row.filter((_, i) => ![4, 15].includes(i))))).toBe('b970a495e4cb833a95d40c774ad45b608bcb4d71fbd2d1adb6ab517b13844065');
    expect(demoMarketContext.festivals).toHaveLength(100);
    expect(buildCountryPeakRows(demoMarketContext.festivals, 'SEA')).toHaveLength(6);
    expect(buildSeasonalPeakRows(demoMarketContext.festivals, 'SEA').length).toBeGreaterThan(2);
    expect(demoMarketContext.climate).toHaveLength(72);
    expect(demoTags.size).toBeGreaterThan(200);
  });
  it('provides distinct local detail links and usable pagination for all countries', () => {
    expect(demoProducts).toHaveLength(600);
    expect(new Set(demoProducts.map(p => p.productId)).size).toBe(600);
    for (const p of demoProducts) {
      expect(p.url).toMatch(/^\/\?demoProduct=demo-product-\d+$/);
      expect(p.image).toMatch(/^https:\/\/copilot-cn\.bytedance\.net\/api\/ide\/v1\/text_to_image\?/);
      expect(p.name).toMatch(/^Demo /);
      expect(p.price).toBeGreaterThan(0);
    }
    for (const country of COUNTRY_CODES.filter(c => c !== 'SEA')) {
      expect(demoProducts.filter(p => p.country === country)).toHaveLength(100);
      expect(demoMaterials.filter(p => p.country === country)).toHaveLength(100);
    }
  });
  it('uses AI creative illustrations and local preview links with fictional metrics', () => {
    expect(demoMaterials).toHaveLength(600);
    for (const material of demoMaterials) {
      expect(material.videoUrl).toMatch(/^\/\?demoMaterial=demo-material-\d+$/);
      expect(material.image).toMatch(/^https:\/\/copilot-cn\.bytedance\.net\/api\/ide\/v1\/text_to_image\?/);
      expect(material.duration).toBe(12);
      expect(material.play3sRate).toBeGreaterThan(material.play50);
      expect(material.play50).toBeGreaterThan(material.play75);
      expect(material.play75).toBeGreaterThan(material.playover);
      expect(material.ctr).toBeGreaterThan(0);
    }
  });
  it('provides a deterministic fictional Top 100 search list for every country', () => {
    expect(demoSearches).toHaveLength(600);
    expect(new Set(demoSearches.map(item => item.term)).size).toBe(600);
    for (const country of COUNTRY_CODES.filter(code => code !== 'SEA')) {
      const rows = demoSearches.filter(item => item.country === country);
      expect(rows).toHaveLength(100);
      expect(rows.map(item => item.rank)).toEqual(
        Array.from({ length: 100 }, (_, index) => index + 1),
      );
      expect(new Set(rows.map(item => item.term)).size).toBe(100);
      expect(rows.every((item, index) =>
        index === 0 || rows[index - 1].searchIndex > item.searchIndex,
      )).toBe(true);
      expect(rows.every(item =>
        item.trend.length === 7 &&
        item.trend.every(value => Number.isFinite(value) && value >= 8 && value <= 98),
      )).toBe(true);
      expect(rows.every(item => !/[\u3400-\u9fff]/.test(item.term))).toBe(true);
    }
  });
  it('uses a full fictional English taxonomy consistently across modules', () => {
    const rows = demoHistory('SEA').categories;
    expect(rows).toHaveLength(480);
    expect([...new Set(rows.map(row => row.l1))]).toEqual([
      'Aster Market', 'Cobalt Market', 'Juniper Market', 'Lumen Market', 'Mosaic Market', 'Vela Market',
    ]);
    expect(rows.every(row => !/[\u3400-\u9fff]/.test([row.l1, row.l2, row.l3, row.leaf].join(' ')))).toBe(true);
    const branches = new Set(rows.map(row => [row.l1, row.l2, row.l3].join('|')));
    expect([...demoProducts, ...demoMaterials, ...demoSearches].every(row =>
      branches.has([row.l1, row.l2, row.l3].join('|')),
    )).toBe(true);
  });
});
