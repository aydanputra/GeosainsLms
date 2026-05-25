import { NextRequest, NextResponse } from 'next/server';
import { updatePost, deletePost, getPostBySlug } from '@/modules/blog/api/service';
import { verifyToken } from '@/modules/auth/utils/auth';
import { prisma } from '@/utils/prisma';
import { writeAuditLog } from '@/utils/audit';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: slug } = await params;
    const post = await getPostBySlug(slug);
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    return NextResponse.json(post);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const existing = await prisma.post.findUnique({ where: { id }, select: { id: true, authorId: true } });
    if (!existing) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

    const isAdmin = user.role === 'ADMIN';
    const isOwnerMentor = user.role === 'MENTOR' && String(existing.authorId) === String(user.id);
    if (!isAdmin && !isOwnerMentor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const updated = await updatePost(id, body);
    await writeAuditLog({
      req,
      actor: { id: String(user.id), role: user.role },
      action: 'POST_UPDATE',
      entityType: 'Post',
      entityId: String(id),
      metadata: { changes: body },
    });
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const existing = await prisma.post.findUnique({ where: { id }, select: { id: true, authorId: true } });
    if (!existing) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

    const isAdmin = user.role === 'ADMIN';
    const isOwnerMentor = user.role === 'MENTOR' && String(existing.authorId) === String(user.id);
    if (!isAdmin && !isOwnerMentor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await deletePost(id);
    await writeAuditLog({
      req,
      actor: { id: String(user.id), role: user.role },
      action: 'POST_DELETE',
      entityType: 'Post',
      entityId: String(id),
    });
    return NextResponse.json({ message: 'Post deleted' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
