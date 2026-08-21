import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Role } from '@prisma/client';
import { prisma } from '@/utils/prisma';
import { markAffiliateWithdrawalByAdmin, syncMentorWithdrawalByAdmin } from '@/app/dashboard/admin/sales/withdraw/page';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('@/modules/auth/utils/auth', () => ({
  verifyToken: vi.fn(),
}));

vi.mock('@/utils/prisma', () => ({
  prisma: {
    mentorWithdrawal: {
      findUnique: vi.fn(),
    },
    withdrawal: {
      findUnique: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

describe('Admin Withdraw Actions', () => {
  const actor = { id: 'admin-1', role: 'ADMIN' as Role };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.XENDIT_SECRET_KEY = 'xendit-secret';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should not overwrite terminal mentor withdrawal status after late sync', async () => {
    (prisma.mentorWithdrawal.findUnique as any).mockResolvedValue({
      id: 'mw-1',
      userId: 'mentor-1',
      amount: 150000,
      status: 'PROCESSING',
      provider: 'XENDIT',
      disbursementId: 'disb-1',
      externalId: 'mw_external',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'disb-1',
          external_id: 'mw_external',
          amount: 150000,
          status: 'COMPLETED',
        }),
      })
    );

    (prisma.$transaction as any).mockImplementation(async (callback: any) =>
      callback({
        mentorWithdrawal: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'mw-1',
            userId: 'mentor-1',
            amount: 150000,
            status: 'SUCCESS',
            externalId: 'mw_external',
          }),
          updateMany: vi.fn(),
        },
        auditLog: {
          create: vi.fn(),
        },
      })
    );

    const result = await syncMentorWithdrawalByAdmin(actor, 'mw-1');

    expect(result).toEqual({ updated: false, notified: false, userId: 'mentor-1', amount: 150000 });
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('should not return affiliate balance when terminal update loses the race', async () => {
    (prisma.$transaction as any).mockImplementation(async (callback: any) =>
      callback({
        withdrawal: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'w-1',
            amount: 50000,
            status: 'PENDING',
            affiliateId: 'aff-1',
            affiliate: { userId: 'user-1' },
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        affiliateProfile: {
          update: vi.fn(),
        },
        auditLog: {
          create: vi.fn(),
        },
      })
    );

    const result = await markAffiliateWithdrawalByAdmin(actor, 'w-1', 'FAILED');

    expect(result).toEqual({ updated: false, notified: false, targetUserId: 'user-1', amount: 50000 });
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('should return affiliate balance only when terminal transition is committed', async () => {
    const affiliateProfileUpdate = vi.fn();
    const withdrawalUpdateMany = vi.fn().mockResolvedValue({ count: 1 });

    (prisma.$transaction as any).mockImplementation(async (callback: any) =>
      callback({
        withdrawal: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'w-1',
            amount: 50000,
            status: 'PENDING',
            affiliateId: 'aff-1',
            affiliate: { userId: 'user-1' },
          }),
          updateMany: withdrawalUpdateMany,
        },
        affiliateProfile: {
          update: affiliateProfileUpdate,
        },
        auditLog: {
          create: vi.fn(),
        },
      })
    );

    const result = await markAffiliateWithdrawalByAdmin(actor, 'w-1', 'FAILED');

    expect(result).toEqual({ updated: true, notified: true, targetUserId: 'user-1', amount: 50000 });
    expect(withdrawalUpdateMany).toHaveBeenCalledWith({
      where: { id: 'w-1', status: { notIn: ['SUCCESS', 'FAILED'] } },
      data: { status: 'FAILED' },
    });
    expect(affiliateProfileUpdate).toHaveBeenCalledWith({
      where: { id: 'aff-1' },
      data: { balance: { increment: 50000 } },
    });
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          title: 'Withdraw Affiliate Gagal',
        }),
      })
    );
  });
});
