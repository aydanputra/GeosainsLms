import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as withdrawWebhookRoute } from '@/app/api/withdraw/webhook/route';
import { prisma } from '@/utils/prisma';
import { writeAuditLog } from '@/utils/audit';

vi.mock('@/utils/prisma', () => ({
  prisma: {
    mentorWithdrawal: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/utils/audit', () => ({
  writeAuditLog: vi.fn(),
}));

describe('Withdraw Webhook Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.XENDIT_CALLBACK_TOKEN = 'withdraw-callback-token';
  });

  it('should reject callback when amount does not match internal withdrawal record', async () => {
    (prisma.mentorWithdrawal.findFirst as any).mockResolvedValue({
      id: 'mw-1',
      status: 'PROCESSING',
      provider: 'XENDIT',
      amount: 150000,
      disbursementId: 'disb-1',
      externalId: 'mw_user_1',
    });

    const req = new NextRequest('http://localhost/api/withdraw/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-callback-token': 'withdraw-callback-token',
      },
      body: JSON.stringify({
        id: 'disb-1',
        external_id: 'mw_user_1',
        amount: 100000,
        status: 'COMPLETED',
      }),
    });

    const res = await withdrawWebhookRoute(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data).toEqual({ error: 'Amount mismatch' });
    expect(prisma.mentorWithdrawal.update).not.toHaveBeenCalled();
    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  it('should accept callback when provider and amount match', async () => {
    (prisma.mentorWithdrawal.findFirst as any).mockResolvedValue({
      id: 'mw-1',
      status: 'PROCESSING',
      provider: 'XENDIT',
      amount: 150000,
      disbursementId: 'disb-1',
      externalId: 'mw_user_1',
    });

    const req = new NextRequest('http://localhost/api/withdraw/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-callback-token': 'withdraw-callback-token',
      },
      body: JSON.stringify({
        id: 'disb-1',
        external_id: 'mw_user_1',
        amount: 150000,
        status: 'COMPLETED',
      }),
    });

    const res = await withdrawWebhookRoute(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(prisma.mentorWithdrawal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'mw-1' },
        data: expect.objectContaining({
          status: 'SUCCESS',
        }),
      })
    );
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'MENTOR_WITHDRAW_WEBHOOK',
        entityType: 'MentorWithdrawal',
        entityId: 'mw-1',
      })
    );
  });
});
