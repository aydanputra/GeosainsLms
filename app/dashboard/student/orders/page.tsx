import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import StudentOrdersClient from './StudentOrdersClient';
import { getProtectedPaymentProofUrl } from '@/modules/shop/utils/paymentProof';

const SETTINGS_SLUG = '__site_settings__';

function safeParse(content: string | null | undefined) {
  if (!content) return {};
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

export default async function Page({ searchParams }: { searchParams?: Promise<{ orderId?: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) return <div>Access Denied</div>;

  const payload = await verifyToken(token);
  const userId = payload?.id ? String(payload.id) : null;
  const role = payload?.role ? String(payload.role) : null;
  if (!userId) return <div>Access Denied</div>;
  if (role !== 'STUDENT' && role !== 'ADMIN' && role !== 'MENTOR') return <div>Access Denied</div>;

  const [orders, settingsPage] = await Promise.all([
    prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { product: true, course: true, serviceBooking: true, rentalReservation: true } },
        payment: true,
        coupon: { select: { code: true } },
      },
    }),
    prisma.page.findUnique({ where: { slug: SETTINGS_SLUG }, select: { content: true } }),
  ]);

  const settings = safeParse(settingsPage?.content);
  const contactEmail = typeof settings.contactEmail === 'string' ? settings.contactEmail.trim() : '';
  const safeOrders = (Array.isArray(orders) ? orders : []).map((order: any) => ({
    ...order,
    manualPaymentProofUrl: getProtectedPaymentProofUrl(
      String(order?.id || ''),
      Boolean(order?.manualPaymentProofMediaId || order?.manualPaymentProofUrl)
    ),
  }));

  const sp = searchParams ? await searchParams : {};
  const highlightId = typeof sp?.orderId === 'string' ? sp.orderId.trim() : '';
  const statusParam = typeof (sp as any)?.status === 'string' ? String((sp as any).status).trim().toUpperCase() : 'ALL';
  const qRaw = typeof (sp as any)?.q === 'string' ? String((sp as any).q).trim() : '';
  return (
    <StudentOrdersClient
      orders={safeOrders as any[]}
      contactEmail={contactEmail}
      initialStatus={statusParam}
      initialQuery={qRaw}
      highlightId={highlightId}
    />
  );
}
