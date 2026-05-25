import { NextRequest, NextResponse } from 'next/server';
import { createPost, getPosts, PostSchema } from '@/modules/blog/api/service';
import { verifyToken } from '@/modules/auth/utils/auth';
import { writeAuditLog } from '@/utils/audit';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get('search') || undefined;
    const authorId = searchParams.get('authorId') || undefined;
    const category = searchParams.get('category') || undefined;
    const tag = searchParams.get('tag') || undefined;
    // By default show only published posts for public API, unless user is admin? 
    // For now, let's assume this is public endpoint, so publishedOnly=true by default.
    // If we want admin to see all, we might need a separate check.
    const publishedOnly = searchParams.get('publishedOnly') !== 'false';

    const posts = await getPosts({ publishedOnly, search, authorId, categorySlug: category, tagSlug: tag });
    return NextResponse.json(posts);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MENTOR')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = PostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Data post tidak valid' }, { status: 400 });
    }

    const created = await createPost(String(user.id), parsed.data);
    await writeAuditLog({
      req,
      actor: { id: String(user.id), role: user.role },
      action: 'POST_CREATE',
      entityType: 'Post',
      entityId: String((created as any)?.id || ''),
      metadata: {
        title: (created as any)?.title,
        slug: (created as any)?.slug,
        published: (created as any)?.published,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
