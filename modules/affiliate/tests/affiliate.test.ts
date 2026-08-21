import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateReferralCode, trackClick, processCommission, requestWithdrawal } from '../api/service';
import { prisma } from '@/utils/prisma';

const prismaMock: any = vi.hoisted(() => ({
    page: {
      findUnique: vi.fn(),
    },
    affiliateProfile: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    affiliateLink: {
      findFirst: vi.fn(),
    },
    referral: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    order: {
      findUnique: vi.fn(),
    },
    commission: {
      findUnique: vi.fn(),
      create: vi.fn(),
      aggregate: vi.fn(),
      updateMany: vi.fn(),
    },
    withdrawal: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (input: any) => {
      if (typeof input === 'function') return input(prismaMock);
      if (Array.isArray(input)) return Promise.all(input);
      return input;
    }),
}));

vi.mock('@/utils/prisma', () => ({
  prisma: prismaMock,
}));

describe('Affiliate Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.page.findUnique as any).mockResolvedValue(null);
    (prisma.commission.aggregate as any).mockResolvedValue({ _sum: { amount: 0 } });
  });

  describe('generateReferralCode', () => {
    it('should create new profile if not exists', async () => {
      (prisma.affiliateProfile.findUnique as any).mockResolvedValue(null);
      (prisma.affiliateProfile.create as any).mockResolvedValue({ id: 'p1', code: 'ABC12345' });

      const result = await generateReferralCode('user-1');

      expect(prisma.affiliateProfile.create).toHaveBeenCalled();
      expect(result).toHaveProperty('code');
    });
  });

  describe('trackClick', () => {
    it('should increment clicks and record referral', async () => {
      const mockProfile = { id: 'p1' };
      (prisma.affiliateProfile.findUnique as any).mockResolvedValue(mockProfile);
      (prisma.referral.findFirst as any).mockResolvedValue(null);
      (prisma.affiliateProfile.update as any).mockResolvedValue({ clicks: 1 });
      (prisma.referral.create as any).mockResolvedValue({ id: 'r1' });

      await trackClick('ABC12345', '127.0.0.1');

      // Since we use transaction, we check if transaction callback was called
      // Or we can check if update and create were called inside the transaction logic
      // In this mock setup, $transaction just executes the callback or promises
      // The implementation calls prisma.affiliateProfile.update inside $transaction
      expect(prisma.affiliateProfile.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { clicks: { increment: 1 } },
      });
      expect(prisma.referral.create).toHaveBeenCalled();
    });
  });

  describe('processCommission', () => {
    it('should calculate commission and update balance', async () => {
      const mockOrder = { id: 'o1', total: 100000, status: 'PAID', userId: 'u2' };
      const mockProfile = { id: 'p1' };
      
      (prisma.order.findUnique as any).mockResolvedValue(mockOrder);
      (prisma.affiliateProfile.findUnique as any).mockResolvedValue(mockProfile);
      (prisma.commission.findUnique as any).mockResolvedValue(null);
      (prisma.commission.create as any).mockResolvedValue({ id: 'c1' });
      (prisma.affiliateProfile.update as any).mockResolvedValue({ id: 'p1' });
      (prisma.referral.updateMany as any).mockResolvedValue({ count: 0 });

      await processCommission('o1', 'ABC12345');

      // 10% of 100,000 = 10,000
      expect(prisma.commission.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ amount: 10000 })
      }));
      expect(prisma.affiliateProfile.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: {
          pendingBalance: { increment: 10000 },
          conversions: { increment: 1 },
        },
      });
    });
  });

  describe('requestWithdrawal', () => {
    it('should create withdrawal request if balance sufficient', async () => {
      (prisma.affiliateProfile.findUnique as any)
        .mockResolvedValueOnce({ id: 'p1', pendingBalance: 0 })
        .mockResolvedValueOnce({ id: 'p1', balance: 100000 });
      (prisma.affiliateProfile.updateMany as any).mockResolvedValue({ count: 1 });
      (prisma.withdrawal.create as any).mockResolvedValue({ id: 'w1' });

      await requestWithdrawal('user-1', 50000);

      expect(prisma.withdrawal.create).toHaveBeenCalled();
      expect(prisma.affiliateProfile.updateMany).toHaveBeenCalledWith({
        where: { id: 'p1', balance: { gte: 50000 } },
        data: { balance: { decrement: 50000 } },
      });
    });

    it('should throw error if balance insufficient', async () => {
      (prisma.affiliateProfile.findUnique as any)
        .mockResolvedValueOnce({ id: 'p1', pendingBalance: 0 })
        .mockResolvedValueOnce({ id: 'p1', balance: 10000 });
      (prisma.affiliateProfile.updateMany as any).mockResolvedValue({ count: 0 });

      await expect(requestWithdrawal('user-1', 50000)).rejects.toThrow('Insufficient balance');
    });
  });
});
