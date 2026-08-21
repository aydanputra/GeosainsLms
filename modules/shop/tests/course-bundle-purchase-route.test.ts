import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as courseBundlePurchaseRoute } from '@/app/api/course-bundles/[id]/purchase/route';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { isSameOrigin } from '@/modules/auth/utils/security';
import { createOrder } from '@/modules/shop/api/service';
import { finalizeOrderPaid } from '@/modules/payment/api/service';

vi.mock('@/utils/prisma', () => ({
  prisma: {
    courseBundle: {
      findUnique: vi.fn(),
    },
    course: {
      findMany: vi.fn(),
    },
    order: {
      updateMany: vi.fn(),
    },
    enrollment: {
      createMany: vi.fn(),
    },
  },
}));

vi.mock('@/modules/auth/utils/auth', () => ({
  verifyToken: vi.fn(),
}));

vi.mock('@/modules/auth/utils/security', () => ({
  isSameOrigin: vi.fn(),
}));

vi.mock('@/modules/shop/api/service', () => ({
  createOrder: vi.fn(),
}));

vi.mock('@/modules/payment/api/service', () => ({
  createPayment: vi.fn(),
  finalizeOrderPaid: vi.fn(),
}));

vi.mock('@/utils/email-notifications', () => ({
  sendStudentOrderCreatedEmail: vi.fn(),
}));

describe('Course Bundle Purchase Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (isSameOrigin as any).mockReturnValue(true);
    (verifyToken as any).mockResolvedValue({ id: 'user-1', role: 'STUDENT' });
    (prisma.courseBundle.findUnique as any).mockResolvedValue({
      id: 'bundle-1',
      published: true,
      courseIds: ['course-1', 'course-2'],
      price: 0,
    });
    (prisma.course.findMany as any).mockResolvedValue([
      { id: 'course-1', title: 'Course 1', slug: 'course-1', price: 100000, instructorId: 'mentor-1' },
      { id: 'course-2', title: 'Course 2', slug: 'course-2', price: 150000, instructorId: 'mentor-2' },
    ]);
    (createOrder as any).mockResolvedValue({
      id: 'order-1',
      total: 0,
    });
  });

  it('should finalize zero-total bundle order through normal paid flow', async () => {
    const req = new NextRequest('http://localhost/api/course-bundles/bundle-1/purchase', {
      method: 'POST',
      headers: {
        cookie: 'token=abc',
      },
    });

    const res = await courseBundlePurchaseRoute(req, { params: Promise.resolve({ id: 'bundle-1' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({
      message: 'Berhasil mendaftar bundle',
      enrolled: true,
      redirectUrl: '/dashboard/student/courses',
    });
    expect(finalizeOrderPaid).toHaveBeenCalledWith('order-1');
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
    expect(prisma.enrollment.createMany).not.toHaveBeenCalled();
  });
});
