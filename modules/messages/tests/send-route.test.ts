import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as sendMessageRoute } from '@/app/api/messages/send/route';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { enforceRateLimit, getClientIp, isSameOrigin } from '@/modules/auth/utils/security';
import { writeRateLimitAuditLog } from '@/utils/audit';

vi.mock('@/utils/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    directThread: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    directMessage: {
      create: vi.fn(),
    },
    auditLog: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/modules/auth/utils/auth', () => ({
  verifyToken: vi.fn(),
}));

vi.mock('@/modules/auth/utils/security', () => ({
  enforceRateLimit: vi.fn(),
  getClientIp: vi.fn(),
  isSameOrigin: vi.fn(),
}));

vi.mock('@/utils/audit', () => ({
  writeAuditLog: vi.fn(),
  writeRateLimitAuditLog: vi.fn(),
}));

describe('Send Message Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (isSameOrigin as any).mockReturnValue(true);
    (getClientIp as any).mockReturnValue('127.0.0.1');
    (enforceRateLimit as any).mockReturnValue({ ok: true });
    (verifyToken as any).mockResolvedValue({ id: 'user-1', role: 'STUDENT' });
  });

  it('should return 429 when message IP rate limit is exceeded', async () => {
    (enforceRateLimit as any).mockReturnValueOnce({ ok: false, retryAfterSeconds: 90 });

    const req = new NextRequest('http://localhost/api/messages/send', {
      method: 'POST',
      body: JSON.stringify({ toUserId: 'user-2', message: 'Halo' }),
      headers: { 'content-type': 'application/json', cookie: 'token=abc' },
    });

    const res = await sendMessageRoute(req);
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('90');
    expect(data).toEqual({ error: 'Terlalu banyak pesan dikirim. Coba lagi nanti.' });
    expect(writeRateLimitAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'MESSAGE_SEND_RATE_LIMITED',
        key: 'messages:send:ip:127.0.0.1',
      })
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('should return 429 when sender user rate limit is exceeded', async () => {
    (enforceRateLimit as any)
      .mockReturnValueOnce({ ok: true })
      .mockReturnValueOnce({ ok: false, retryAfterSeconds: 75 });

    const req = new NextRequest('http://localhost/api/messages/send', {
      method: 'POST',
      body: JSON.stringify({ toUserId: 'user-2', message: 'Halo' }),
      headers: { 'content-type': 'application/json', cookie: 'token=abc' },
    });

    const res = await sendMessageRoute(req);
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('75');
    expect(data).toEqual({ error: 'Terlalu banyak pesan untuk akun ini. Coba lagi nanti.' });
    expect(writeRateLimitAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'MESSAGE_SEND_RATE_LIMITED',
        key: 'messages:send:user:user-1',
      })
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('should still allow valid message send within limits', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'user-2', role: 'ADMIN' });
    (prisma.directThread.findUnique as any).mockResolvedValue(null);
    (prisma.directThread.create as any).mockResolvedValue({ id: 'thread-1', userAId: 'user-1', userBId: 'user-2' });
    (prisma.auditLog.findMany as any).mockResolvedValue([]);
    (prisma.directMessage.create as any).mockResolvedValue({ id: 'msg-1' });
    (prisma.directThread.update as any).mockResolvedValue({ id: 'thread-1' });

    const req = new NextRequest('http://localhost/api/messages/send', {
      method: 'POST',
      body: JSON.stringify({ toUserId: 'user-2', message: 'Halo Admin', topic: 'TECH_SUPPORT' }),
      headers: { 'content-type': 'application/json', cookie: 'token=abc' },
    });

    const res = await sendMessageRoute(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ ok: true, threadId: 'thread-1' });
    expect(prisma.directMessage.create).toHaveBeenCalled();
    expect(prisma.directThread.update).toHaveBeenCalled();
  });
});
