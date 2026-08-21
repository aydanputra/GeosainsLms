import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as affiliateWithdrawRoute } from '@/app/api/affiliate/withdraw/route';
import { requestWithdrawal } from '@/modules/affiliate/api/service';
import { verifyToken } from '@/modules/auth/utils/auth';
import { isSameOrigin } from '@/modules/auth/utils/security';
import { writeAuditLog } from '@/utils/audit';
import { prisma } from '@/utils/prisma';

vi.mock('@/modules/affiliate/api/service', () => ({
  requestWithdrawal: vi.fn(),
  WithdrawalSchema: {
    safeParse: vi.fn((value: any) => ({ success: Number(value?.amount) >= 50000, data: value })),
  },
}));

vi.mock('@/modules/auth/utils/auth', () => ({
  verifyToken: vi.fn(),
}));

vi.mock('@/modules/auth/utils/security', () => ({
  isSameOrigin: vi.fn(),
}));

vi.mock('@/utils/audit', () => ({
  writeAuditLog: vi.fn(),
}));

vi.mock('@/utils/prisma', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
    },
    notification: {
      createMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

describe('Affiliate Withdraw Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (isSameOrigin as any).mockReturnValue(true);
    (verifyToken as any).mockResolvedValue({ id: 'user-1', role: 'STUDENT' });
    (prisma.user.findMany as any).mockResolvedValue([{ id: 'admin-1' }]);
    (requestWithdrawal as any).mockResolvedValue({ id: 'withdraw-1', amount: 50000, status: 'PENDING' });
  });

  it('should record withdrawal id in audit and admin notification', async () => {
    const req = new NextRequest('http://localhost/api/affiliate/withdraw', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: 'token=abc',
      },
      body: JSON.stringify({ amount: 50000, note: 'withdraw please' }),
    });

    const res = await affiliateWithdrawRoute(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data).toEqual({ id: 'withdraw-1', amount: 50000, status: 'PENDING' });
    expect(prisma.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            title: 'Permintaan Withdraw Affiliate',
            message: expect.stringContaining('Withdrawal: withdraw-1'),
          }),
        ],
      })
    );
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'AFFILIATE_WITHDRAW_REQUEST',
        entityType: 'Withdrawal',
        entityId: 'withdraw-1',
      })
    );
  });
});
