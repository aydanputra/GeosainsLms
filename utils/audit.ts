import { prisma } from '@/utils/prisma';
import { getClientIp } from '@/modules/auth/utils/security';
import type { NextRequest } from 'next/server';
import { Prisma, type Role } from '@prisma/client';

type Actor = {
  id: string;
  role: Role;
  email?: string | null;
};

export async function writeAuditLog(opts: {
  req?: NextRequest;
  actor?: Actor | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue | null;
}) {
  try {
    const ip = opts.req ? getClientIp(opts.req) : null;
    const userAgent = opts.req ? opts.req.headers.get('user-agent') : null;
    const metadata =
      opts.metadata === undefined ? undefined : opts.metadata === null ? Prisma.DbNull : opts.metadata;
    await prisma.auditLog.create({
      data: {
        actorId: opts.actor?.id ?? null,
        actorRole: opts.actor?.role ?? null,
        action: opts.action,
        entityType: opts.entityType,
        entityId: opts.entityId ?? null,
        ip: ip ?? null,
        userAgent: userAgent ?? null,
        ...(metadata !== undefined ? { metadata } : {}),
      },
    });
  } catch {
  }
}

export async function writeRateLimitAuditLog(opts: {
  req?: NextRequest;
  actor?: Actor | null;
  action: string;
  key: string;
  retryAfterSeconds: number;
  entityType?: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue | null;
}) {
  const metadata =
    opts.metadata && typeof opts.metadata === 'object' && !Array.isArray(opts.metadata)
      ? ({
          ...opts.metadata,
          rateLimitKey: opts.key,
          retryAfterSeconds: opts.retryAfterSeconds,
        } as Prisma.InputJsonValue)
      : ({
          rateLimitKey: opts.key,
          retryAfterSeconds: opts.retryAfterSeconds,
        } as Prisma.InputJsonValue);

  return writeAuditLog({
    req: opts.req,
    actor: opts.actor,
    action: opts.action,
    entityType: opts.entityType || 'RateLimit',
    entityId: opts.entityId,
    metadata,
  });
}

export async function writeAccessDeniedAuditLog(opts: {
  req?: NextRequest;
  actor?: Actor | null;
  action: string;
  status: 401 | 403;
  entityType: string;
  entityId?: string | null;
  reason: string;
  metadata?: Prisma.InputJsonValue | null;
}) {
  const metadata =
    opts.metadata && typeof opts.metadata === 'object' && !Array.isArray(opts.metadata)
      ? ({
          ...opts.metadata,
          status: opts.status,
          reason: opts.reason,
        } as Prisma.InputJsonValue)
      : ({
          status: opts.status,
          reason: opts.reason,
        } as Prisma.InputJsonValue);

  return writeAuditLog({
    req: opts.req,
    actor: opts.actor,
    action: opts.action,
    entityType: opts.entityType,
    entityId: opts.entityId,
    metadata,
  });
}
