import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('..', import.meta.url));
async function files(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const name = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await files(name));
    else result.push(name);
  }
  return result;
}
const forbidden = /larkoffice|\/aeolus\/|@aeolus|@edenx|tt4b-[\w-]+\.svg|read_range|update_range|play_auth_token|GetPlayInfo|ibyteimg|tiktokcdn|tiktok-row|x-signature|refresh_token|VideoID=/i;
const sourceForbidden = /larkoffice|ibyteimg|tiktokcdn|tiktok-row|x-signature|refresh_token|VideoID=/i;
const production = await files(path.join(root, 'dist'));
let hasNotice = false;
let hasAiImages = false;
for (const file of production) {
  assert(!file.endsWith('.map'), `Unexpected source map: ${file}`);
  if (!/\.(html|js|css|json|svg)$/.test(file)) continue;
  const text = await readFile(file, 'utf8');
  assert(!forbidden.test(text), `Business integration or logo in: ${path.relative(root, file)}`);
  hasNotice ||= text.includes('数据均为非真实业务数据，仅用于交互功能演示。');
  hasAiImages ||= text.includes('copilot-cn.bytedance.net/api/ide/v1/text_to_image');
}
assert(hasNotice, 'Chinese demo notice missing from build');
assert(hasAiImages, 'AI illustration endpoint missing from build');
const source = await files(path.join(root, 'src'));
assert(!source.some(name => /\/infra\/|useTraffic|useSheetMatrix|\/history\/[A-Z]+\.json|product-images\.json|video-ids\.json|material-covers\.json|category-labels\.json|materialCover\.ts/.test(name)), 'Business or retired media source copied into demo');
for (const file of source) {
  if (!/\.(tsx?|json|css|svg)$/.test(file)) continue;
  assert(!sourceForbidden.test(await readFile(file, 'utf8')), `Original media or business integration in: ${path.relative(root, file)}`);
}
const history = await readFile(path.join(root, 'src/data/demo/history.ts'), 'utf8');
assert(history.includes('fictional-taxonomy-v3') && history.includes('Array.from({ length: 480 }'), 'Generated fictional taxonomy required');
const searches = await readFile(path.join(root, 'src/data/demo/search.ts'), 'utf8');
assert(
  searches.includes('fictional-search-term-pool-v1') &&
    searches.includes('Array.from({ length: 100 }'),
  'Generated fictional country Top 100 searches required',
);
console.log(`PASS: ${production.length} production files checked; Chinese notice, generated fictional taxonomy/searches and AI illustrations present; no original media links, logos or business APIs.`);
