// Custom image loader that bypasses broken /_next/image endpoint
// Uses /api/image-optimize which has working Sharp
export default function imageLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  const params = new URLSearchParams();
  params.set('url', src);
  params.set('w', String(width));
  if (quality) params.set('q', String(quality));
  return `/api/image-optimize?${params.toString()}`;
}