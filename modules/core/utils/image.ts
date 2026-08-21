const ABSOLUTE_HTTP_RE = /^https?:\/\//i;

type NormalizeOptions = {
  fallback?: string | null;
};

type CloudinaryOptions = {
  width?: number;
  height?: number;
  quality?: number | 'auto';
  fit?: 'fill' | 'fit' | 'limit' | 'pad' | 'scale';
};

export function normalizeImageUrl(value: string | null | undefined, options: NormalizeOptions = {}) {
  const fallback = options.fallback ?? null;
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('blob:')) return fallback;
  if (trimmed.startsWith('/') || ABSOLUTE_HTTP_RE.test(trimmed)) return trimmed;
  return fallback;
}

export function pickImageUrl(values: Array<string | null | undefined>, options: NormalizeOptions = {}) {
  for (const value of values) {
    const normalized = normalizeImageUrl(value);
    if (normalized) return normalized;
  }
  return options.fallback ?? null;
}

export function toOptimizedImageUrl(value: string | null | undefined, options: CloudinaryOptions = {}) {
  const normalized = normalizeImageUrl(value);
  if (!normalized) return null;
  if (!ABSOLUTE_HTTP_RE.test(normalized)) return normalized;

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return normalized;
  }

  if (parsed.hostname !== 'res.cloudinary.com') return normalized;
  if (!parsed.pathname.includes('/image/upload/')) return normalized;

  const transforms = ['f_auto'];
  transforms.push(typeof options.quality === 'number' ? `q_${Math.max(1, Math.min(100, options.quality))}` : 'q_auto');
  if (typeof options.width === 'number' && options.width > 0) transforms.push(`w_${Math.round(options.width)}`);
  if (typeof options.height === 'number' && options.height > 0) transforms.push(`h_${Math.round(options.height)}`);
  if (options.fit) transforms.push(`c_${options.fit}`);

  parsed.pathname = parsed.pathname.replace('/image/upload/', `/image/upload/${transforms.join(',')}/`);
  return parsed.toString();
}
