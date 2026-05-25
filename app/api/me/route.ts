import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { createToken, hashPassword, verifyPassword, verifyToken } from '@/modules/auth/utils/auth';
import { isSameOrigin, validatePasswordStrength } from '@/modules/auth/utils/security';

function normalizeMediaUrl(input: string) {
  const v = String(input || '').trim();
  if (!v) return '';
  const lower = v.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:')) return null;
  if (v.startsWith('/')) return v;
  try {
    const u = new URL(v);
    if (u.protocol === 'http:' || u.protocol === 'https:') return v;
    return null;
  } catch {
    return null;
  }
}

function isValidEmail(input: string) {
  const v = String(input || '').trim().toLowerCase();
  if (!v) return false;
  if (v.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ user: null, loginHistory: [] }, { status: 200 });

    const payload = await verifyToken(token);
    if (!payload?.id) return NextResponse.json({ user: null, loginHistory: [] }, { status: 200 });

    const userId = String(payload.id);
    const roleRaw = typeof (payload as any)?.role === 'string' ? String((payload as any).role).toUpperCase() : '';
    const loginHistoryScopeRaw = req.nextUrl.searchParams.get('loginHistoryScope');
    const loginHistoryScope = loginHistoryScopeRaw === 'members' ? 'members' : 'self';

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        profileCoverUrl: true,
        signatureUrl: true,
        phone: true,
        gender: true,
        birthDate: true,
        country: true,
        province: true,
        city: true,
        address: true,
        socialLinks: true,
        mentorJobTitle: true,
        mentorBio: true,
        mentorSkills: true,
        mentorEducations: true,
        mentorExperiences: true,
        mentorAttachments: true,
        role: true,
        isSuperAdmin: true,
        totpEnabled: true,
        totpVerifiedAt: true,
        createdAt: true,
      } as any,
    });

    if (!user) return NextResponse.json({ user: null, loginHistory: [] }, { status: 200 });

    const role = roleRaw || (typeof (user as any)?.role === 'string' ? String((user as any).role).toUpperCase() : '');

    let actorIds: string[] | null = null;
    if (loginHistoryScope === 'members' && (role === 'ADMIN' || role === 'MENTOR')) {
      if (role === 'ADMIN') {
        actorIds = null;
      } else {
        const enrollments = await prisma.enrollment.findMany({
          where: { course: { instructorId: userId } },
          select: { userId: true },
          distinct: ['userId'],
          take: 10_000,
        });
        const ids = (Array.isArray(enrollments) ? enrollments : [])
          .map((e) => String((e as any).userId || ''))
          .filter(Boolean);
        actorIds = ids.length ? ids : [];
      }
    } else {
      actorIds = [userId];
    }

    if (Array.isArray(actorIds) && actorIds.length === 0) {
      return NextResponse.json({ user, loginHistory: [] }, { status: 200 });
    }

    const take = loginHistoryScope === 'members' ? 400 : 120;
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        ...(actorIds ? { actorId: { in: actorIds } } : {}),
        OR: [{ action: { startsWith: 'AUTH_LOGIN' } }, { action: 'AUTH_LOGOUT' }],
      },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        actorId: true,
        action: true,
        ip: true,
        userAgent: true,
        metadata: true,
        createdAt: true,
        actor: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    const logoutBySessionId = new Map<string, string>();
    for (const log of Array.isArray(auditLogs) ? auditLogs : []) {
      if (log?.action !== 'AUTH_LOGOUT') continue;
      const meta: any = log?.metadata && typeof log.metadata === 'object' ? (log.metadata as any) : null;
      const sessionId = typeof meta?.sessionId === 'string' && meta.sessionId ? meta.sessionId : null;
      if (!sessionId) continue;
      const actorKey = typeof (log as any)?.actorId === 'string' && (log as any).actorId ? String((log as any).actorId) : '';
      const key = `${actorKey}:${sessionId}`;
      if (!logoutBySessionId.has(key)) {
        logoutBySessionId.set(key, new Date(log.createdAt as any).toISOString());
      }
    }

    const loginHistory = (Array.isArray(auditLogs) ? auditLogs : [])
      .filter((l) => l && typeof l === 'object' && typeof (l as any).action === 'string' && String((l as any).action).startsWith('AUTH_LOGIN'))
      .slice(0, loginHistoryScope === 'members' ? 60 : 20)
      .map((l) => {
        const meta: any = l?.metadata && typeof l.metadata === 'object' ? (l.metadata as any) : {};
        const sessionId = typeof meta?.sessionId === 'string' && meta.sessionId ? meta.sessionId : null;
        const actorKey = typeof (l as any)?.actorId === 'string' && (l as any).actorId ? String((l as any).actorId) : '';
        const key = sessionId ? `${actorKey}:${sessionId}` : '';
        const sessionEnd = sessionId ? logoutBySessionId.get(key) || null : null;
        const nextMeta = sessionEnd ? { ...meta, sessionEnd } : meta;
        return { ...l, metadata: nextMeta };
      });

    return NextResponse.json({
      user,
      loginHistory,
    });
  } catch (error: any) {
    return NextResponse.json({ user: null, loginHistory: [], error: error.message || 'Failed to fetch session' }, { status: 200 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json()) as {
      name?: unknown;
      email?: unknown;
      avatarUrl?: unknown;
      profileCoverUrl?: unknown;
      signatureUrl?: unknown;
      phone?: unknown;
      gender?: unknown;
      birthDate?: unknown;
      country?: unknown;
      province?: unknown;
      city?: unknown;
      address?: unknown;
      socialLinks?: unknown;
      currentPassword?: unknown;
      newPassword?: unknown;
      mentorJobTitle?: unknown;
      mentorBio?: unknown;
      mentorSkills?: unknown;
      mentorEducations?: unknown;
      mentorExperiences?: unknown;
      mentorAttachments?: unknown;
    };

    const name = typeof body.name === 'string' ? body.name.trim() : undefined;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : undefined;
    const avatarUrlRaw = typeof body.avatarUrl === 'string' ? body.avatarUrl : undefined;
    const profileCoverUrlRaw = typeof body.profileCoverUrl === 'string' ? body.profileCoverUrl : undefined;
    const signatureUrlRaw = typeof body.signatureUrl === 'string' ? body.signatureUrl : undefined;
    const avatarUrl = typeof avatarUrlRaw === 'string' ? normalizeMediaUrl(avatarUrlRaw) : undefined;
    const profileCoverUrl = typeof profileCoverUrlRaw === 'string' ? normalizeMediaUrl(profileCoverUrlRaw) : undefined;
    const signatureUrl = typeof signatureUrlRaw === 'string' ? normalizeMediaUrl(signatureUrlRaw) : undefined;
    const phone = typeof body.phone === 'string' ? body.phone.trim() : undefined;
    const gender = typeof body.gender === 'string' ? body.gender.trim() : undefined;
    const birthDateRaw = body.birthDate;
    const country = typeof body.country === 'string' ? body.country.trim() : undefined;
    const province = typeof body.province === 'string' ? body.province.trim() : undefined;
    const city = typeof body.city === 'string' ? body.city.trim() : undefined;
    const address = typeof body.address === 'string' ? body.address.trim() : undefined;
    const socialLinksRaw = body.socialLinks;
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
    const mentorJobTitle = typeof body.mentorJobTitle === 'string' ? body.mentorJobTitle.trim() : undefined;
    const mentorBio = typeof body.mentorBio === 'string' ? body.mentorBio : undefined;
    const mentorSkillsRaw = body.mentorSkills;
    const mentorEducationsRaw = body.mentorEducations;
    const mentorExperiencesRaw = body.mentorExperiences;
    const mentorAttachmentsRaw = body.mentorAttachments;

    if (avatarUrlRaw !== undefined && avatarUrl === null) return NextResponse.json({ error: 'avatarUrl tidak valid' }, { status: 400 });
    if (profileCoverUrlRaw !== undefined && profileCoverUrl === null)
      return NextResponse.json({ error: 'profileCoverUrl tidak valid' }, { status: 400 });
    if (signatureUrlRaw !== undefined && signatureUrl === null) return NextResponse.json({ error: 'signatureUrl tidak valid' }, { status: 400 });

    const existing = (await prisma.user.findUnique({
      where: { id: String(payload.id) },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        profileCoverUrl: true,
        signatureUrl: true,
        phone: true,
        gender: true,
        birthDate: true,
        country: true,
        province: true,
        city: true,
        address: true,
        socialLinks: true,
        mentorJobTitle: true,
        mentorBio: true,
        mentorSkills: true,
        mentorEducations: true,
        mentorExperiences: true,
        mentorAttachments: true,
        isSuperAdmin: true,
        role: true,
        password: true,
        createdAt: true,
      } as any,
    })) as any;
    if (!existing) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const data: any = {};
    if (typeof name === 'string' && name.length >= 2) data.name = name;
    if (typeof avatarUrl === 'string') data.avatarUrl = avatarUrl ? avatarUrl : null;
    if (typeof profileCoverUrl === 'string') data.profileCoverUrl = profileCoverUrl ? profileCoverUrl : null;
    if (typeof signatureUrl === 'string') data.signatureUrl = signatureUrl ? signatureUrl : null;
    if (typeof phone === 'string') data.phone = phone ? phone : null;
    if (typeof gender === 'string') {
      const g = gender.toUpperCase();
      data.gender = g === 'MALE' || g === 'FEMALE' ? g : null;
    }
    if (birthDateRaw === null) {
      data.birthDate = null;
    } else if (typeof birthDateRaw === 'string' && birthDateRaw.trim()) {
      const iso = birthDateRaw.trim();
      const d = new Date(`${iso}T00:00:00.000Z`);
      if (!Number.isNaN(d.getTime())) data.birthDate = d;
    }
    if (typeof country === 'string') data.country = country ? country : null;
    if (typeof province === 'string') data.province = province ? province : null;
    if (typeof city === 'string') data.city = city ? city : null;
    if (typeof address === 'string') data.address = address ? address : null;
    if (socialLinksRaw === null) {
      data.socialLinks = null;
    } else if (socialLinksRaw && typeof socialLinksRaw === 'object' && !Array.isArray(socialLinksRaw)) {
      const instagram = typeof (socialLinksRaw as any).instagram === 'string' ? (socialLinksRaw as any).instagram.trim() : '';
      const whatsapp = typeof (socialLinksRaw as any).whatsapp === 'string' ? (socialLinksRaw as any).whatsapp.trim() : '';
      const facebook = typeof (socialLinksRaw as any).facebook === 'string' ? (socialLinksRaw as any).facebook.trim() : '';
      const linkedin = typeof (socialLinksRaw as any).linkedin === 'string' ? (socialLinksRaw as any).linkedin.trim() : '';
      const tiktok = typeof (socialLinksRaw as any).tiktok === 'string' ? (socialLinksRaw as any).tiktok.trim() : '';
      data.socialLinks = {
        instagram: instagram || null,
        whatsapp: whatsapp || null,
        facebook: facebook || null,
        linkedin: linkedin || null,
        tiktok: tiktok || null,
      };
    }

    if (existing.role === 'MENTOR') {
      if (typeof mentorJobTitle === 'string') data.mentorJobTitle = mentorJobTitle ? mentorJobTitle : null;
      if (typeof mentorBio === 'string') data.mentorBio = mentorBio.trim() ? mentorBio : null;

      if (Array.isArray(mentorSkillsRaw)) {
        const skills = mentorSkillsRaw
          .filter((v) => typeof v === 'string')
          .map((v) => v.trim())
          .filter(Boolean)
          .slice(0, 30);
        data.mentorSkills = skills;
      }

      if (mentorEducationsRaw === null) {
        data.mentorEducations = null;
      } else if (Array.isArray(mentorEducationsRaw)) {
        data.mentorEducations = mentorEducationsRaw.slice(0, 30);
      }

      if (mentorExperiencesRaw === null) {
        data.mentorExperiences = null;
      } else if (Array.isArray(mentorExperiencesRaw)) {
        data.mentorExperiences = mentorExperiencesRaw.slice(0, 30);
      }

      if (mentorAttachmentsRaw === null) {
        data.mentorAttachments = null;
      } else if (Array.isArray(mentorAttachmentsRaw)) {
        data.mentorAttachments = mentorAttachmentsRaw.slice(0, 50);
      }
    }

    const wantsEmailChange = typeof email === 'string' && email && email !== existing.email;
    const wantsPasswordChange = typeof newPassword === 'string' && newPassword.length > 0;

    if (wantsEmailChange || wantsPasswordChange) {
      if (!currentPassword) return NextResponse.json({ error: 'Password saat ini wajib diisi' }, { status: 400 });
      const ok = await verifyPassword(currentPassword, existing.password);
      if (!ok) return NextResponse.json({ error: 'Password saat ini salah' }, { status: 400 });
    }

    if (wantsEmailChange) {
      if (!isValidEmail(email)) return NextResponse.json({ error: 'Format email tidak valid' }, { status: 400 });
      const emailUsed = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (emailUsed && emailUsed.id !== existing.id) return NextResponse.json({ error: 'Email sudah digunakan' }, { status: 409 });
      data.email = email;
    }

    if (wantsPasswordChange) {
      const isSuperAdmin = String(existing.role || '') === 'ADMIN' && Boolean(existing.isSuperAdmin);
      const pwCheck = validatePasswordStrength(newPassword, { minLength: isSuperAdmin ? 12 : 8, strict: isSuperAdmin });
      if (!pwCheck.ok) return NextResponse.json({ error: pwCheck.error }, { status: 400 });
      data.password = await hashPassword(newPassword);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        {
          user: {
            id: existing.id,
            name: existing.name,
            email: existing.email,
            avatarUrl: existing.avatarUrl,
            profileCoverUrl: existing.profileCoverUrl,
            signatureUrl: existing.signatureUrl,
            phone: existing.phone,
            gender: existing.gender,
            birthDate: existing.birthDate,
            country: existing.country,
            province: existing.province,
            city: existing.city,
            address: existing.address,
            socialLinks: existing.socialLinks,
            mentorJobTitle: existing.mentorJobTitle,
            mentorBio: existing.mentorBio,
            mentorSkills: existing.mentorSkills,
            mentorEducations: existing.mentorEducations,
            mentorExperiences: existing.mentorExperiences,
            mentorAttachments: existing.mentorAttachments,
            role: existing.role,
            createdAt: existing.createdAt,
          },
        },
        { status: 200 }
      );
    }

    const updated = (await prisma.user.update({
      where: { id: existing.id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        profileCoverUrl: true,
        signatureUrl: true,
        phone: true,
        gender: true,
        birthDate: true,
        country: true,
        province: true,
        city: true,
        address: true,
        socialLinks: true,
        mentorJobTitle: true,
        mentorBio: true,
        mentorSkills: true,
        mentorEducations: true,
        mentorExperiences: true,
        mentorAttachments: true,
        isSuperAdmin: true,
        totpEnabled: true,
        role: true,
        createdAt: true,
      } as any,
    })) as any;

    const newToken = await createToken({
      id: updated.id,
      email: updated.email,
      role: updated.role,
      isSuperAdmin: Boolean((updated as any).isSuperAdmin),
      totpEnabled: Boolean((updated as any).totpEnabled),
    });
    const res = NextResponse.json({ user: updated }, { status: 200 });
    res.cookies.set('token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24,
      path: '/',
    });
    return res;
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal memperbarui profil' }, { status: 500 });
  }
}
