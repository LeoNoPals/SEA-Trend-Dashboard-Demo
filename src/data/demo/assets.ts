import { MARKET_CODES } from '../market';
import type { TopProduct } from '../topProduct';
import type { TopMaterial } from '../topMaterial';
import { demoLabels, randomFor } from './history';

const IMAGE_ENDPOINT = 'https://copilot-cn.bytedance.net/api/ide/v1/text_to_image';
const PRODUCT_SUBJECTS = [
  'a compact matte green desk organizer with modular trays',
  'a translucent coral reusable drink bottle with a loop cap',
  'a cream portable reading lamp with a round base',
  'a charcoal woven travel pouch with a brass zipper',
  'a pale blue ceramic aroma diffuser with a wood accent',
  'a mustard yellow folding storage basket with fabric handles',
  'a white ergonomic wireless mouse with subtle gray details',
  'a ruby red insulated lunch container with a steel rim',
  'a mint green handheld garment steamer with a simple silhouette',
  'a navy blue compact picnic blanket with a canvas strap',
  'a blush pink tabletop mirror with a slim metal stand',
  'a graphite gray portable fan with a circular grille',
] as const;

function aiImage(prompt: string, imageSize: 'square_hd' | 'portrait_16_9') {
  return `${IMAGE_ENDPOINT}?prompt=${encodeURIComponent(prompt)}&image_size=${imageSize}`;
}

function productImage(index: number) {
  const subject = PRODUCT_SUBJECTS[index % PRODUCT_SUBJECTS.length];
  return aiImage(
    `Professional ecommerce studio photograph of ${subject}, a completely fictional unbranded product, clean light gray seamless background, realistic materials, soft diffused daylight, centered composition, sharp focus, no people, no text, no logos, no trademarks, no watermark`,
    'square_hd',
  );
}

function creativeImage(index: number) {
  const subject = PRODUCT_SUBJECTS[(index * 5 + 3) % PRODUCT_SUBJECTS.length];
  return aiImage(
    `Vertical ecommerce short-form video cover featuring ${subject}, completely fictional unbranded product in a bright modern home setting, dynamic but realistic composition, natural daylight, no people, no text, no logos, no trademarks, no watermark`,
    'portrait_16_9',
  );
}

export const DEMO_ASSET_COUNT = 600;

function designFor(index: number) {
  const [l1, l2, l3, leaf] = demoLabels[(index * 17) % demoLabels.length];
  return { l1: String(l1), l2: String(l2), l3: String(l3), leaf: String(leaf) };
}

export const demoProducts: TopProduct[] = Array.from({ length: DEMO_ASSET_COUNT }, (_, index) => {
  const design = designFor(index);
  const random = randomFor(`fictional-product-${index}`);
  const productId = `demo-product-${index + 1}`;
  return {
    ...design,
    country: MARKET_CODES[index % MARKET_CODES.length],
    productId,
    name: `Demo ${design.leaf} · Edition ${String(index + 1).padStart(3, '0')}`,
    image: productImage(index),
    url: `${import.meta.env.BASE_URL}?demoProduct=${productId}`,
    price: Math.round((5 + random() * 80) * 100) / 100,
    bundle: index % 4 === 0,
    fresh: index % 3 === 0,
  };
});

export const demoMaterials: TopMaterial[] = Array.from({ length: DEMO_ASSET_COUNT }, (_, index) => {
  const design = designFor(index + 29);
  const random = randomFor(`fictional-creative-${index}`);
  const vid = `demo-material-${index + 1}`;
  const retention3 = 0.45 + random() * 0.4;
  const retention50 = retention3 * (0.55 + random() * 0.3);
  const retention75 = retention50 * (0.5 + random() * 0.3);
  return {
    key: vid,
    vid,
    name: `Demo ${design.leaf} · Creative ${String(index + 1).padStart(3, '0')}`,
    image: creativeImage(index),
    l1: design.l1,
    l2: design.l2,
    l3: design.l3,
    country: MARKET_CODES[index % MARKET_CODES.length],
    videoUrl: `${import.meta.env.BASE_URL}?demoMaterial=${vid}`,
    duration: 12,
    play3sRate: retention3,
    play50: retention50,
    play75: retention75,
    playover: retention75 * (0.5 + random() * 0.3),
    ctr: 0.01 + random() * 0.06,
    cvr: 0.005 + random() * 0.045,
  };
});
