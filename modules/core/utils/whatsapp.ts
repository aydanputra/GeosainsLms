export function normalizeWhatsAppNumber(value: unknown) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';

  const cleaned = raw.replace(/[^\d+]/g, '');
  if (!cleaned) return '';

  if (cleaned.startsWith('+')) return cleaned.slice(1);
  if (cleaned.startsWith('0')) return `62${cleaned.slice(1)}`;
  return cleaned;
}

export function buildWhatsAppUrl(value: unknown, message?: string | null) {
  const phone = normalizeWhatsAppNumber(value);
  if (!phone) return '';

  const text = typeof message === 'string' ? message.trim() : '';
  return text ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/${phone}`;
}
