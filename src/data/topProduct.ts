/** All products in this build are fictional demonstration records. */
export type TopProduct = {
  country: string;
  l1: string;
  l2: string;
  l3: string;
  productId: string;
  name: string;
  image: string;
  url: string;
  bundle: boolean;
  fresh: boolean;
  price: number | null;
};

export function largeImageUrl(url: string) { return url; }

export function formatPrice(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '—' : `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;
}
