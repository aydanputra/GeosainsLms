import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const RAW_SECRET = process.env.JWT_SECRET;
const SECRET_KEY = RAW_SECRET ? new TextEncoder().encode(RAW_SECRET) : null;

export async function middleware(req: NextRequest) {
  if (!SECRET_KEY) {
    return NextResponse.json({ error: 'Server misconfigured: JWT_SECRET is required' }, { status: 500 });
  }
  const token = req.cookies.get('token')?.value;
  const { pathname } = req.nextUrl;

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    const userRole = payload.role as string;

    // Role-based access control
    const mentorAllowedAdminPaths = [
      '/dashboard/admin/courses/categories',
      '/dashboard/admin/shop/categories',
    ];
    const isMentorAllowedAdminPath =
      userRole === 'MENTOR' && mentorAllowedAdminPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));

    if (pathname.startsWith('/dashboard/admin') && userRole !== 'ADMIN' && !isMentorAllowedAdminPath) {
      return NextResponse.redirect(new URL('/dashboard', req.url)); // Or unauthorized page
    }

    const isSuperAdmin = userRole === 'ADMIN' && Boolean((payload as any)?.isSuperAdmin);
    const totpEnabled = Boolean((payload as any)?.totpEnabled);
    if (pathname.startsWith('/dashboard/admin') && isSuperAdmin && !totpEnabled) {
      return NextResponse.redirect(new URL('/dashboard/settings?force2fa=1', req.url));
    }

    if (pathname.startsWith('/dashboard/mentor') && userRole !== 'MENTOR') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    if (pathname.startsWith('/dashboard/student') && userRole !== 'STUDENT' && userRole !== 'MENTOR') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    return NextResponse.next();

  } catch {
    // Token is invalid or expired
    return NextResponse.redirect(new URL('/login', req.url));
  }
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
