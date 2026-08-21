import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const ALLOWED_SOURCES = [
  'res.cloudinary.com',
  'geosains.id',
  'www.geosains.id',
];

const CACHE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function isAbsoluteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function parseUrl(url: string): { hostname: string; pathname: string } | null {
  try {
    const u = new URL(url);
    return { hostname: u.hostname, pathname: u.pathname + u.search };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  const width = parseInt(searchParams.get('w') || '0', 10);
  const quality = parseInt(searchParams.get('q') || '75', 10);

  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  const safeWidth = Math.min(Math.max(width || 0, 16), 3840);
  const safeQuality = Math.min(Math.max(quality, 10), 100);

  let imageBuffer: Buffer;

  try {
    if (isAbsoluteUrl(url)) {
      // Remote image
      const parsed = parseUrl(url);
      if (!parsed || !ALLOWED_SOURCES.includes(parsed.hostname)) {
        return new NextResponse('Source not allowed', { status: 403 });
      }
      const fetchRes = await fetch(url, {
        headers: { 'User-Agent': 'GeosainsLMS/1.0', 'Accept': 'image/*' },
      });
      if (!fetchRes.ok) {
        return new NextResponse('Failed to fetch image', { status: 502 });
      }
      imageBuffer = Buffer.from(await fetchRes.arrayBuffer());
    } else {
      // Local image (from public/ directory)
      const filePath = path.join(process.cwd(), 'public', url.replace(/^\//, ''));
      if (!existsSync(filePath)) {
        return new NextResponse('Image not found', { status: 404 });
      }
      imageBuffer = await readFile(filePath);
    }
  } catch (err: any) {
    return new NextResponse(`Error: ${err.message}`, { status: 500 });
  }

  try {
    const sharp = (await import('sharp')).default;
    const metadata = await sharp(imageBuffer, { failOn: 'none' }).metadata();

    let pipeline = sharp(imageBuffer, { failOn: 'none' });

    if (safeWidth > 0) {
      pipeline = pipeline.resize(safeWidth, undefined, {
        withoutEnlargement: true,
        fit: 'inside',
      });
    }

    const optimized = await pipeline
      .webp({ quality: safeQuality })
      .toBuffer();

    const headers = new Headers();
    headers.set('Content-Type', 'image/webp');
    headers.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE}, immutable`);
    headers.set('X-Original-Size', String(imageBuffer.length));
    headers.set('X-Optimized-Size', String(optimized.length));

    return new NextResponse(optimized, { headers });
  } catch (err: any) {
    return new NextResponse(`Optimization error: ${err.message}`, { status: 500 });
  }
}