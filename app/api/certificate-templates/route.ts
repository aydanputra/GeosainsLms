import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { verifyToken } from '@/modules/auth/utils/auth';

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get('token')?.value;
  if (!token) return null;
  const user = await verifyToken(token);
  if (!user || user.role !== 'ADMIN') return null;
  return user;
}

export async function GET(req: NextRequest) {
  try {
    const templates = await prisma.certificateTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(templates, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal mengambil template' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await req.json();
    const { name, content, isSystem } = body;

    if (!name || !content) {
      return NextResponse.json({ error: 'Name and content are required' }, { status: 400 });
    }

    const template = await prisma.certificateTemplate.create({
      data: {
        name,
        content: typeof content === 'string' ? JSON.parse(content) : content,
        isSystem: !!isSystem,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal membuat template' }, { status: 500 });
  }
}
