import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { CourseStatus } from '@prisma/client';

function toInt(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function normalizePair(a: string, b: string) {
  return a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: courseId } = await params;

    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await verifyToken(token);
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true, slug: true, instructorId: true, deletedAt: true, status: true },
    });
    if (!course || course.deletedAt) return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    if (course.status !== CourseStatus.PUBLISHED) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const rawLimit = toInt(req.nextUrl.searchParams.get('limit'));
    const limit = Math.max(1, Math.min(50, rawLimit ?? 20));
    const cursor = req.nextUrl.searchParams.get('cursor');

    const rows = await prisma.courseComment.findMany({
      where: { courseId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor
        ? {
            cursor: { id: String(cursor) },
            skip: 1,
          }
        : {}),
      select: {
        id: true,
        body: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        replies: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            body: true,
            createdAt: true,
            user: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } },
          },
        },
      },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? page[page.length - 1]?.id || null : null;

    return NextResponse.json(
      {
        comments: page.map((c) => ({
          id: c.id,
          body: c.body,
          createdAt: c.createdAt,
          user: {
            id: c.user.id,
            name: c.user.name || c.user.email,
            email: c.user.email,
            avatarUrl: c.user.avatarUrl,
          },
          replies: (Array.isArray((c as any).replies) ? (c as any).replies : []).map((r: any) => ({
            id: String(r.id),
            body: String(r.body || ''),
            createdAt: r.createdAt,
            user: {
              id: String(r.user?.id || ''),
              name: String(r.user?.name || r.user?.email || ''),
              email: String(r.user?.email || ''),
              avatarUrl: typeof r.user?.avatarUrl === 'string' ? r.user.avatarUrl : null,
              role: String(r.user?.role || ''),
            },
          })),
        })),
        nextCursor,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load comments' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: courseId } = await params;

    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await verifyToken(token);
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const me = String(user.id);

    const body = (await req.json().catch(() => ({}))) as { comment?: unknown; message?: unknown; replyToCommentId?: unknown };
    const comment = typeof body?.comment === 'string' ? body.comment.trim() : typeof body?.message === 'string' ? body.message.trim() : '';
    const replyToCommentId = typeof body?.replyToCommentId === 'string' ? body.replyToCommentId.trim() : '';
    if (comment.length < 2) return NextResponse.json({ error: 'Komentar minimal 2 karakter' }, { status: 400 });
    if (comment.length > 2000) return NextResponse.json({ error: 'Komentar terlalu panjang' }, { status: 400 });

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        title: true,
        slug: true,
        instructorId: true,
        deletedAt: true,
        status: true,
        coInstructors: { select: { userId: true } },
      },
    });
    if (!course || course.deletedAt) return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    if (course.status !== CourseStatus.PUBLISHED) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const href = `/courses/${encodeURIComponent(String(course.slug))}?tab=komentar`;
    const instructorIds = new Set<string>();
    if (course.instructorId) instructorIds.add(String(course.instructorId));
    for (const co of Array.isArray(course.coInstructors) ? course.coInstructors : []) {
      if (co?.userId) instructorIds.add(String(co.userId));
    }

    const isInstructor = instructorIds.has(me);

    if (replyToCommentId) {
      const parent = await prisma.courseComment.findUnique({
        where: { id: replyToCommentId },
        select: { id: true, courseId: true, userId: true },
      });
      if (!parent || parent.courseId !== courseId) return NextResponse.json({ error: 'Komentar tidak ditemukan' }, { status: 404 });
      if (!isInstructor && String(parent.userId) !== me) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const createdReply = await prisma.courseCommentReply.create({
        data: { commentId: parent.id, userId: me, body: comment },
        select: { id: true, body: true, createdAt: true },
      });

      const recipients = new Set<string>();
      if (isInstructor) {
        recipients.add(String(parent.userId));
      } else {
        for (const id of instructorIds) recipients.add(id);
      }
      recipients.delete(me);

      if (recipients.size > 0) {
        const payload = [`Kursus: ${course.title}`, `Slug: ${course.slug}`, `COMMENT_ID: ${parent.id}`, comment, `LINK:${href}`]
          .filter(Boolean)
          .join('\n');
        const now = new Date();
        for (const recipientId of recipients) {
          const pair = normalizePair(me, recipientId);
          const isA = pair.userAId === me;

          const thread = await prisma.directThread.upsert({
            where: { userAId_userBId: pair },
            update: {},
            create: {
              ...pair,
              lastReadAtA: now,
              lastReadAtB: now,
              unreadCountA: 0,
              unreadCountB: 0,
            },
            select: { id: true },
          });

          await prisma.directMessage.create({ data: { threadId: thread.id, senderId: me, body: payload } });

          await prisma.directThread.update({
            where: { id: thread.id },
            data: isA
              ? {
                  lastMessageAt: now,
                  lastMessageText: payload.slice(0, 300),
                  lastMessageSenderId: me,
                  lastReadAtA: now,
                  unreadCountB: { increment: 1 },
                }
              : {
                  lastMessageAt: now,
                  lastMessageText: payload.slice(0, 300),
                  lastMessageSenderId: me,
                  lastReadAtB: now,
                  unreadCountA: { increment: 1 },
                },
          });
        }
      }

      return NextResponse.json(
        {
          ok: true,
          reply: { id: createdReply.id, body: createdReply.body, createdAt: createdReply.createdAt, commentId: parent.id },
        },
        { status: 201 }
      );
    }

    const created = await prisma.courseComment.create({
      data: { courseId, userId: me, body: comment },
      select: { id: true, body: true, createdAt: true, user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });

    const recipients = new Set<string>(Array.from(instructorIds));
    recipients.delete(me);

    if (recipients.size > 0) {
      const payload = [`Kursus: ${course.title}`, `Slug: ${course.slug}`, `COMMENT_ID: ${created.id}`, comment, `LINK:${href}`]
        .filter(Boolean)
        .join('\n');
      const now = new Date();
      for (const recipientId of recipients) {
        const pair = normalizePair(me, recipientId);
        const isA = pair.userAId === me;

        const thread = await prisma.directThread.upsert({
          where: { userAId_userBId: pair },
          update: {},
          create: {
            ...pair,
            lastReadAtA: now,
            lastReadAtB: now,
            unreadCountA: 0,
            unreadCountB: 0,
          },
          select: { id: true },
        });

        await prisma.directMessage.create({ data: { threadId: thread.id, senderId: me, body: payload } });

        await prisma.directThread.update({
          where: { id: thread.id },
          data: isA
            ? {
                lastMessageAt: now,
                lastMessageText: payload.slice(0, 300),
                lastMessageSenderId: me,
                lastReadAtA: now,
                unreadCountB: { increment: 1 },
              }
            : {
                lastMessageAt: now,
                lastMessageText: payload.slice(0, 300),
                lastMessageSenderId: me,
                lastReadAtB: now,
                unreadCountA: { increment: 1 },
              },
        });
      }
    }

    return NextResponse.json(
      {
        ok: true,
        comment: {
          id: created.id,
          body: created.body,
          createdAt: created.createdAt,
          user: {
            id: created.user.id,
            name: created.user.name || created.user.email,
            email: created.user.email,
            avatarUrl: created.user.avatarUrl,
          },
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to post comment' }, { status: 500 });
  }
}
