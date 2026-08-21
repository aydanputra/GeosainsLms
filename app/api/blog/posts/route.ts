import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag, revalidatePath } from 'next/cache';
import { createPost, getPosts, PostSchema } from '@/modules/blog/api/service';
import { verifyToken } from '@/modules/auth/utils/auth';
import { writeAuditLog } from '@/utils/audit';
import { sanitizeRichHtml } from '@/modules/core/utils/sanitizeHtml';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get('search') || undefined;
    const authorId = searchParams.get('authorId') || undefined;
    const category = searchParams.get('category') || undefined;
    const tag = searchParams.get('tag') || undefined;
    const wantsDraftAccess = searchParams.get('publishedOnly') === 'false';
    const token = req.cookies.get('token')?.value;
    const user = token ? await verifyToken(token) : null;
    const canViewDrafts =
      Boolean(user?.role === 'ADMIN') ||
      Boolean(user?.role === 'MENTOR' && authorId && String(authorId) === String(user.id));
    const publishedOnly = wantsDraftAccess ? !canViewDrafts : true;

    const posts = await getPosts({ publishedOnly, search, authorId, categorySlug: category, tagSlug: tag });
    return NextResponse.json(
      posts.map((post) => ({
        ...post,
        content: sanitizeRichHtml(post.content),
      }))
    );
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
    revalidateTag('public-blog-post-previews', { expire: 0 });
    revalidateTag('public-blog-slugs', { expire: 0 });
    revalidateTag('public-blog-category-slugs', { expire: 0 });
    revalidateTag('public-blog-tag-slugs', { expire: 0 });
    revalidatePath('/blog');
    revalidatePath('/');
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
