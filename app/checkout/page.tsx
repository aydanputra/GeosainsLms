import CheckoutPage from '@/modules/shop/pages/CheckoutPage';
import CourseCheckoutPage from '@/modules/course/pages/CourseCheckoutPage';
import { prisma } from '@/utils/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

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

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = (await searchParams) || {};
  const courseIdRaw = sp.courseId;
  const courseId = typeof courseIdRaw === 'string' ? courseIdRaw : Array.isArray(courseIdRaw) ? courseIdRaw[0] : '';

  if (!courseId) return <CheckoutPage />;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      slug: true,
      title: true,
      price: true,
      normalPrice: true,
      thumbnailUrl: true,
      status: true,
      deletedAt: true,
    },
  });

  if (!course || course.deletedAt || course.status !== 'PUBLISHED') {
    return <CheckoutPage />;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value || '';
  const redirectToCheckout = `/checkout?courseId=${encodeURIComponent(course.id)}`;
  if (!token) redirect(`/login?redirect=${encodeURIComponent(redirectToCheckout)}`);

  const user = await verifyToken(token).catch(() => null);
  if (!user?.id) redirect(`/login?redirect=${encodeURIComponent(redirectToCheckout)}`);

  const profile = await prisma.user.findUnique({
    where: { id: String(user.id) },
    select: { id: true, name: true, email: true, phone: true, city: true, address: true },
  });

  const isProfileComplete = (() => {
    const name = String(profile?.name || '').trim();
    const phone = String((profile as any)?.phone || '').trim();
    const city = String((profile as any)?.city || '').trim();
    const address = String((profile as any)?.address || '').trim();
    if (name.length < 2) return false;
    if (phone.length < 8) return false;
    if (city.length < 2) return false;
    if (address.length < 5) return false;
    return true;
  })();

  if (!isProfileComplete) {
    redirect(`/dashboard/settings?redirect=${encodeURIComponent(redirectToCheckout)}`);
  }

  const userName = profile?.name || profile?.email || '';

  const settingsPage = await prisma.page.findUnique({ where: { slug: '__site_settings__' }, select: { content: true } });
  const settings = safeParse(settingsPage?.content);
  const methodRaw = typeof settings?.paymentMethod === 'string' ? String(settings.paymentMethod).trim().toUpperCase() : '';
  const paymentMethod = methodRaw === 'MIDTRANS' || methodRaw === 'MANUAL' ? methodRaw : 'XENDIT';

  const courseSettingsPage = await prisma.page.findUnique({ where: { slug: '__course_settings__' }, select: { content: true } });
  const courseSettings = safeParse(courseSettingsPage?.content);
  const checkoutServiceFeeEnabled = courseSettings?.checkoutServiceFeeEnabled === true;
  const checkoutServiceFeeAmountRaw = Number(courseSettings?.checkoutServiceFeeAmount);
  const checkoutServiceFeeAmount = Number.isFinite(checkoutServiceFeeAmountRaw) ? Math.max(0, Math.round(checkoutServiceFeeAmountRaw)) : 0;
  const checkoutUniqueCodeEnabled = courseSettings?.checkoutUniqueCodeEnabled === true;
  const checkoutUniqueCodeDigitsRaw = Number(courseSettings?.checkoutUniqueCodeDigits);
  const checkoutUniqueCodeDigits = Number.isFinite(checkoutUniqueCodeDigitsRaw) ? Math.min(3, Math.max(1, Math.floor(checkoutUniqueCodeDigitsRaw))) : 3;

  return (
    <CourseCheckoutPage
      course={{
        id: course.id,
        slug: course.slug,
        title: course.title,
        price: Number(course.price || 0),
        normalPrice: course.normalPrice === null ? null : Number(course.normalPrice || 0),
        thumbnailUrl: course.thumbnailUrl || null,
      }}
      initialPaymentMethod={paymentMethod as any}
      userName={userName}
      checkoutSettings={{
        checkoutServiceFeeEnabled,
        checkoutServiceFeeAmount,
        checkoutUniqueCodeEnabled,
        checkoutUniqueCodeDigits,
      }}
    />
  );
}
