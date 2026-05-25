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
