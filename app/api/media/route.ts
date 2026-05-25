import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';
import { readdir, stat } from 'fs/promises';
import path from 'path';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const q = (searchParams.get('q') || '').trim();
    const scope = (searchParams.get('scope') || 'mine').toLowerCase();
    const altFilter = (searchParams.get('alt') || '').trim();

    const takeRaw = Number(searchParams.get('take') || '60');
    const skipRaw = Number(searchParams.get('skip') || '0');

    const take = Number.isFinite(takeRaw) ? Math.max(1, Math.min(200, takeRaw)) : 60;
    const skip = Number.isFinite(skipRaw) ? Math.max(0, skipRaw) : 0;

    const isAdmin = user.role === 'ADMIN';
    const where = {
      ...(scope === 'all' && isAdmin ? {} : { userId: String(user.id) }),
      ...(altFilter ? { alt: { contains: altFilter, mode: 'insensitive' as const } } : {}),
      ...(q
        ? {
            OR: [
              { filename: { contains: q, mode: 'insensitive' as const } },
              { alt: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.mediaAsset.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.mediaAsset.count({ where }),
    ]);

    return NextResponse.json({ items, total, take, skip });
  } catch (error: unknown) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

function guessMimeType(filename: string) {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

function inferCreatedAtFromFilename(filename: string) {
  const m = /^(\d{10,})-/.exec(filename);
  if (!m) return null;
  const raw = Number(m[1]);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  const ms = raw < 1e12 ? raw * 1000 : raw;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) as any;
    const action = typeof body?.action === 'string' ? body.action : '';
    if (action !== 'reindex') return NextResponse.json({ error: 'Bad Request' }, { status: 400 });

    const assignTo = body?.assignTo === 'folder' ? 'folder' : 'me';
    const baseDir = path.join(process.cwd(), 'public', 'uploads', 'media');

    const existing = await prisma.mediaAsset.findMany({
      where: { url: { startsWith: '/uploads/media/' } },
      select: { url: true },
    });
    const existingUrl = new Set(existing.map((e) => e.url));

    const entries = await readdir(baseDir, { withFileTypes: true }).catch(() => []);
    const folders = entries.filter((e) => e.isDirectory()).map((e) => e.name);

    let scanned = 0;
    let created = 0;
    let skipped = 0;
    let orphanFolders = 0;

    for (const folderName of folders) {
      const folderPath = path.join(baseDir, folderName);
      const files = await readdir(folderPath, { withFileTypes: true }).catch(() => []);
      const userExists = await prisma.user.findUnique({ where: { id: folderName }, select: { id: true } });
      if (!userExists) orphanFolders += 1;

      const ownerId = assignTo === 'folder' && userExists ? folderName : String(user.id);

      for (const f of files) {
        if (!f.isFile()) continue;
        const filename = f.name;
        if (!filename || filename.startsWith('.')) continue;

        scanned += 1;
        const url = `/uploads/media/${folderName}/${filename}`;
        if (existingUrl.has(url)) {
          skipped += 1;
          continue;
        }

        const absolutePath = path.join(folderPath, filename);
        const st = await stat(absolutePath).catch(() => null);
        if (!st) {
          skipped += 1;
          continue;
        }

        const createdAt = inferCreatedAtFromFilename(filename);
        const storagePath = path.join('public', 'uploads', 'media', folderName, filename);

        await prisma.mediaAsset.create({
          data: {
            userId: ownerId,
            url,
            storagePath,
            filename,
            mimeType: guessMimeType(filename),
            size: st.size,
            alt: null,
            ...(createdAt ? { createdAt } : {}),
          },
        });
        existingUrl.add(url);
        created += 1;
      }
    }

    return NextResponse.json(
      {
        ok: true,
        scanned,
        created,
        skipped,
        folders: folders.length,
        orphanFolders,
        assignedTo: assignTo,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
