import { middleware as roleMiddleware } from '@/modules/auth/middleware/roleMiddleware';

export const middleware = roleMiddleware;

export const config = {
  matcher: ['/dashboard/:path*'],
};
