export function getProtectedPaymentProofUrl(orderId: string | null | undefined, hasProofSource?: boolean | null) {
  const safeOrderId = typeof orderId === 'string' ? orderId.trim() : '';
  if (!safeOrderId || !hasProofSource) return null;
  return `/api/shop/orders/${encodeURIComponent(safeOrderId)}/payment-proof/file`;
}
