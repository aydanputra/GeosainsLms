import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { Role } from '@prisma/client';
import { hashPassword, verifyToken } from '@/modules/auth/utils/auth';
import { writeAccessDeniedAuditLog, writeAuditLog } from '@/utils/audit';
import { isSameOrigin, validatePasswordStrength } from '@/modules/auth/utils/security';

async function auditUsersDenied(
  request: NextRequest,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  status: 401 | 403,
  reason: string,
  actor?: { id: string; role: Role } | null,
  entityId?: string | null
) {
  await writeAccessDeniedAuditLog({
    req: request,
    actor: actor || null,
    action: 'USER_ADMIN_ROUTE_DENIED',
    status,
    entityType: 'User',
    entityId: entityId || null,
    reason,
    metadata: { method },
  });
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;
    if (!token) {
      await auditUsersDenied(request, 'GET', 401, 'missing_token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user || user.role !== 'ADMIN') {
      await auditUsersDenied(
        request,
        'GET',
        403,
        user ? 'forbidden' : 'invalid_token',
        user ? { id: String(user.id), role: user.role } : null
      );
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const where = role ? { role: role as Role } : {};
    
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isSuperAdmin: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(users);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) {
      await auditUsersDenied(request, 'POST', 403, 'cross_origin');
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const token = request.cookies.get('token')?.value;
    if (!token) {
      await auditUsersDenied(request, 'POST', 401, 'missing_token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user || user.role !== 'ADMIN') {
      await auditUsersDenied(
        request,
        'POST',
        403,
        user ? 'forbidden' : 'invalid_token',
        user ? { id: String(user.id), role: user.role } : null
      );
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const actorId = user?.id ? String(user.id) : '';
    const actor = actorId ? await prisma.user.findUnique({ where: { id: actorId }, select: { isSuperAdmin: true } }) : null;
    const actorIsSuperAdmin = Boolean(actor?.isSuperAdmin);

    const body = (await request.json()) as {
      name?: unknown;
      email?: unknown;
      password?: unknown;
      role?: unknown;
      isSuperAdmin?: unknown;
    };

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const roleInput = typeof body.role === 'string' ? body.role.trim() : '';

    if (!name || name.length < 2) return NextResponse.json({ error: 'Nama minimal 2 karakter' }, { status: 400 });
    if (!email || !email.includes('@')) return NextResponse.json({ error: 'Email tidak valid' }, { status: 400 });

    const allowedRoles: Role[] = ['ADMIN', 'MENTOR', 'STUDENT', 'VENDOR'];
    const role = (allowedRoles.includes(roleInput as Role) ? (roleInput as Role) : 'STUDENT') as Role;
    const isSuperAdmin = Boolean(body.isSuperAdmin) && role === 'ADMIN';
    if (isSuperAdmin && !actorIsSuperAdmin) {
      await auditUsersDenied(request, 'POST', 403, 'superadmin_required', { id: String(user.id), role: user.role });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) return NextResponse.json({ error: 'Email sudah digunakan' }, { status: 409 });

    const pwCheck = validatePasswordStrength(password, { minLength: isSuperAdmin ? 12 : 8, strict: isSuperAdmin });
    if (!pwCheck.ok) return NextResponse.json({ error: pwCheck.error }, { status: 400 });

    const created = await prisma.user.create({
      data: {
        name,
        email,
        password: await hashPassword(password),
        role,
        ...(isSuperAdmin ? { isSuperAdmin: true } : {}),
        emailVerifiedAt: new Date(),
      },
      select: { id: true, name: true, email: true, role: true, isSuperAdmin: true },
    });

    await writeAuditLog({
      req: request,
      actor: { id: String(user.id), role: user.role },
      action: 'USER_CREATE',
      entityType: 'User',
      entityId: created.id,
      metadata: { role: created.role, email: created.email },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to create user' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) {
      await auditUsersDenied(request, 'PUT', 403, 'cross_origin');
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const token = request.cookies.get('token')?.value;
    if (!token) {
      await auditUsersDenied(request, 'PUT', 401, 'missing_token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const actor = await verifyToken(token);
    if (!actor || actor.role !== 'ADMIN') {
      await auditUsersDenied(
        request,
        'PUT',
        403,
        actor ? 'forbidden' : 'invalid_token',
        actor ? { id: String(actor.id), role: actor.role } : null
      );
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const actorId = actor?.id ? String(actor.id) : '';
    const actorDb = actorId ? await prisma.user.findUnique({ where: { id: actorId }, select: { isSuperAdmin: true } }) : null;
    const actorIsSuperAdmin = Boolean(actorDb?.isSuperAdmin);

    const body = (await request.json().catch(() => ({}))) as {
      id?: unknown;
      name?: unknown;
      email?: unknown;
      role?: unknown;
      isSuperAdmin?: unknown;
    };

    const id = typeof body.id === 'string' ? body.id.trim() : '';
    if (!id) return NextResponse.json({ error: 'id wajib diisi' }, { status: 400 });

    const existing = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, role: true, isSuperAdmin: true } });
    if (!existing) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });

    const name = typeof body.name === 'string' ? body.name.trim() : null;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : null;
    const roleInput = typeof body.role === 'string' ? body.role.trim() : null;

    const allowedRoles: Role[] = ['ADMIN', 'MENTOR', 'STUDENT', 'VENDOR'];
    const nextRole = roleInput ? (allowedRoles.includes(roleInput as Role) ? (roleInput as Role) : null) : null;
    const nextIsSuperAdminRaw = body.isSuperAdmin;
    const nextIsSuperAdmin =
      nextIsSuperAdminRaw === undefined || nextIsSuperAdminRaw === null
        ? null
        : Boolean(nextIsSuperAdminRaw);

    if (name !== null && name.length < 2) return NextResponse.json({ error: 'Nama minimal 2 karakter' }, { status: 400 });
    if (email !== null && (!email || !email.includes('@'))) return NextResponse.json({ error: 'Email tidak valid' }, { status: 400 });

    if (actorId && id === actorId && nextRole && nextRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Tidak bisa mengubah role akun yang sedang login' }, { status: 400 });
    }

    if (!actorIsSuperAdmin) {
      if (nextIsSuperAdmin !== null) {
        await auditUsersDenied(request, 'PUT', 403, 'superadmin_required', { id: String(actor.id), role: actor.role }, id);
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (existing.isSuperAdmin && nextRole && nextRole !== 'ADMIN') {
        await auditUsersDenied(request, 'PUT', 403, 'superadmin_required', { id: String(actor.id), role: actor.role }, id);
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    if (existing.role === 'ADMIN' && nextRole && nextRole !== 'ADMIN') {
      const admins = await prisma.user.count({ where: { role: 'ADMIN' } });
      if (admins <= 1) {
        return NextResponse.json({ error: 'Tidak bisa menurunkan role admin terakhir' }, { status: 400 });
      }
    }

    if (
      existing.role === 'ADMIN' &&
      existing.isSuperAdmin &&
      ((nextRole && nextRole !== 'ADMIN') || nextIsSuperAdmin === false)
    ) {
      const superAdmins = await prisma.user.count({ where: { role: 'ADMIN', isSuperAdmin: true } });
      if (superAdmins <= 1) {
        return NextResponse.json({ error: 'Tidak bisa menurunkan Super Admin terakhir' }, { status: 400 });
      }
    }

    if (email !== null && email !== existing.email) {
      const emailUsed = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (emailUsed && emailUsed.id !== id) return NextResponse.json({ error: 'Email sudah digunakan' }, { status: 409 });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(name !== null ? { name } : {}),
        ...(email !== null ? { email } : {}),
        ...(nextRole ? { role: nextRole } : {}),
        ...(nextIsSuperAdmin !== null ? { isSuperAdmin: nextIsSuperAdmin && (nextRole ? nextRole === 'ADMIN' : existing.role === 'ADMIN') } : {}),
      },
      select: { id: true, name: true, email: true, role: true, isSuperAdmin: true },
    });

    await writeAuditLog({
      req: request,
      actor: { id: String(actor.id), role: actor.role },
      action: 'USER_UPDATE',
      entityType: 'User',
      entityId: updated.id,
      metadata: { email: updated.email, role: updated.role, isSuperAdmin: Boolean((updated as any).isSuperAdmin) },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to update user' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) {
      await auditUsersDenied(request, 'PATCH', 403, 'cross_origin');
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const token = request.cookies.get('token')?.value;
    if (!token) {
      await auditUsersDenied(request, 'PATCH', 401, 'missing_token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const actor = await verifyToken(token);
    if (!actor || actor.role !== 'ADMIN') {
      await auditUsersDenied(
        request,
        'PATCH',
        403,
        actor ? 'forbidden' : 'invalid_token',
        actor ? { id: String(actor.id), role: actor.role } : null
      );
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const actorId = actor?.id ? String(actor.id) : '';
    const actorDb = actorId ? await prisma.user.findUnique({ where: { id: actorId }, select: { isSuperAdmin: true } }) : null;
    const actorIsSuperAdmin = Boolean(actorDb?.isSuperAdmin);

    const body = (await request.json().catch(() => ({}))) as {
      id?: unknown;
      password?: unknown;
    };

    const id = typeof body.id === 'string' ? body.id.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!id) return NextResponse.json({ error: 'id wajib diisi' }, { status: 400 });
    const existing = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, role: true, isSuperAdmin: true } });
    if (!existing) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    if (Boolean(existing.isSuperAdmin) && !actorIsSuperAdmin) {
      await auditUsersDenied(request, 'PATCH', 403, 'superadmin_required', { id: String(actor.id), role: actor.role }, id);
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const targetIsSuperAdmin = String(existing.role || '') === 'ADMIN' && Boolean((existing as any).isSuperAdmin);
    const pwCheck = validatePasswordStrength(password, { minLength: targetIsSuperAdmin ? 12 : 8, strict: targetIsSuperAdmin });
    if (!pwCheck.ok) return NextResponse.json({ error: pwCheck.error }, { status: 400 });

    const hashed = await hashPassword(password);
    await prisma.$transaction(async (tx: any) => {
      await tx.user.update({
        where: { id },
        data: { password: hashed, sessionVersion: { increment: 1 } },
      });
      await tx.passwordResetToken.deleteMany({ where: { userId: id } });
    });

    await writeAuditLog({
      req: request,
      actor: { id: String(actor.id), role: actor.role },
      action: 'USER_PASSWORD_SET',
      entityType: 'User',
      entityId: existing.id,
      metadata: { email: existing.email, role: existing.role },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to set user password' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) {
      await auditUsersDenied(request, 'DELETE', 403, 'cross_origin');
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const token = request.cookies.get('token')?.value;
    if (!token) {
      await auditUsersDenied(request, 'DELETE', 401, 'missing_token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const actor = await verifyToken(token);
    if (!actor || actor.role !== 'ADMIN') {
      await auditUsersDenied(
        request,
        'DELETE',
        403,
        actor ? 'forbidden' : 'invalid_token',
        actor ? { id: String(actor.id), role: actor.role } : null
      );
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const actorId = actor?.id ? String(actor.id) : '';
    const actorDb = actorId ? await prisma.user.findUnique({ where: { id: actorId }, select: { isSuperAdmin: true } }) : null;
    const actorIsSuperAdmin = Boolean(actorDb?.isSuperAdmin);

    const body = (await request.json().catch(() => ({}))) as {
      id?: unknown;
      ids?: unknown;
      force?: unknown;
    };

    const idsInput = Array.isArray(body.ids) ? body.ids : typeof body.id === 'string' ? [body.id] : [];
    const ids = idsInput.map((v) => (typeof v === 'string' ? v.trim() : '')).filter(Boolean);
    if (ids.length === 0) return NextResponse.json({ error: 'id/ids wajib diisi' }, { status: 400 });
    const force = body.force === true;

    if (actorId && ids.includes(actorId)) {
      return NextResponse.json({ error: 'Tidak bisa menghapus akun yang sedang login' }, { status: 400 });
    }

    const deletedIds: string[] = [];
    const blocked: Array<{ id: string; reason: string }> = [];

    for (const id of ids) {
      const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, isSuperAdmin: true } });
      if (!target) {
        blocked.push({ id, reason: 'User tidak ditemukan' });
        continue;
      }

      if (Boolean(target.isSuperAdmin) && !actorIsSuperAdmin) {
        blocked.push({ id, reason: 'Forbidden' });
        continue;
      }

      if (String(target.role || '') === 'ADMIN') {
        const admins = await prisma.user.count({ where: { role: 'ADMIN' } });
        if (admins <= 1) {
          blocked.push({ id, reason: 'Tidak bisa menghapus admin terakhir' });
          continue;
        }
      }

      if (target.isSuperAdmin) {
        const superAdmins = await prisma.user.count({ where: { role: 'ADMIN', isSuperAdmin: true } });
        if (superAdmins <= 1) {
          blocked.push({ id, reason: 'Tidak bisa menghapus Super Admin terakhir' });
          continue;
        }
      }

      try {
        await prisma.$transaction(async (tx: any) => {
          if (force) {
            await tx.shopVendorMember.deleteMany({ where: { userId: id } });
            await tx.shopVendor.updateMany({ where: { ownerId: id }, data: { ownerId: null } } as any);

            await tx.courseCoInstructor.deleteMany({ where: { userId: id } });
            await tx.courseReview.deleteMany({ where: { userId: id } });
            await tx.enrollment.deleteMany({ where: { userId: id } });
            await tx.userProgress.deleteMany({ where: { userId: id } });
            await tx.quizAttempt.deleteMany({ where: { userId: id } });
            await tx.assignmentSubmission.deleteMany({ where: { userId: id } });
            await tx.certificate.deleteMany({ where: { userId: id } });

            await tx.notification.deleteMany({ where: { userId: id } });
            await tx.subscription.deleteMany({ where: { userId: id } });
            await tx.mediaAsset.deleteMany({ where: { userId: id } });

            await tx.post.deleteMany({ where: { authorId: id } } as any);

            await tx.qAReply.deleteMany({ where: { authorId: id } } as any);
            await tx.qAThread.deleteMany({ where: { authorId: id } } as any);

            const orderRows = await tx.order.findMany({ where: { userId: id }, select: { id: true } });
            const orderIds = orderRows.map((o: { id: string }) => o.id);
            if (orderIds.length > 0) {
              await tx.payment.deleteMany({ where: { orderId: { in: orderIds } } });
              await tx.commission.deleteMany({ where: { orderId: { in: orderIds } } });
              await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
              await tx.order.deleteMany({ where: { id: { in: orderIds } } });
            }

            const aff = await tx.affiliateProfile.findUnique({ where: { userId: id }, select: { id: true } });
            if (aff?.id) {
              await tx.withdrawal.deleteMany({ where: { affiliateId: aff.id } });
              await tx.commission.deleteMany({ where: { affiliateId: aff.id } });
              await tx.referral.deleteMany({ where: { affiliateId: aff.id } });
              await tx.affiliateProfile.delete({ where: { id: aff.id } });
            }
            await tx.referral.deleteMany({ where: { userId: id } } as any);

            await tx.course.updateMany({ where: { instructorId: id }, data: { instructorId: actorId } });
          } else {
            const [
              coursesTaught,
              enrollments,
              orders,
              posts,
              qaThreads,
              qaReplies,
              quizAttempts,
              assignmentSubmissions,
              certificates,
              affiliateProfile,
              shopVendors,
            ] = await Promise.all([
              tx.course.count({ where: { instructorId: id } }),
              tx.enrollment.count({ where: { userId: id } }),
              tx.order.count({ where: { userId: id } }),
              tx.post.count({ where: { authorId: id } } as any),
              tx.qAThread.count({ where: { authorId: id } } as any),
              tx.qAReply.count({ where: { authorId: id } } as any),
              tx.quizAttempt.count({ where: { userId: id } }),
              tx.assignmentSubmission.count({ where: { userId: id } }),
              tx.certificate.count({ where: { userId: id } }),
              tx.affiliateProfile.count({ where: { userId: id } }),
              tx.shopVendor.count({ where: { ownerId: id } } as any),
            ]);

            const blockers = [
              coursesTaught ? `courses(${coursesTaught})` : null,
              enrollments ? `enrollments(${enrollments})` : null,
              orders ? `orders(${orders})` : null,
              posts ? `posts(${posts})` : null,
              qaThreads ? `qaThreads(${qaThreads})` : null,
              qaReplies ? `qaReplies(${qaReplies})` : null,
              quizAttempts ? `quizAttempts(${quizAttempts})` : null,
              assignmentSubmissions ? `assignmentSubmissions(${assignmentSubmissions})` : null,
              certificates ? `certificates(${certificates})` : null,
              affiliateProfile ? `affiliateProfile(${affiliateProfile})` : null,
              shopVendors ? `shopVendors(owner)(${shopVendors})` : null,
            ].filter(Boolean) as string[];

            if (blockers.length > 0) {
              throw new Error(`Tidak bisa dihapus karena masih punya relasi: ${blockers.join(', ')}`);
            }

            await tx.shopVendorMember.deleteMany({ where: { userId: id } });
          }

          await tx.user.delete({ where: { id } });
        });
        deletedIds.push(id);
      } catch (e: any) {
        blocked.push({ id, reason: e?.message || 'Gagal menghapus user' });
      }
    }

    await writeAuditLog({
      req: request,
      actor: { id: String(actor.id), role: actor.role },
      action: 'USER_DELETE_BULK',
      entityType: 'User',
      entityId: null,
      metadata: { deletedIds, blocked, force },
    });

    return NextResponse.json({ deletedIds, blocked }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to delete users' }, { status: 500 });
  }
}
