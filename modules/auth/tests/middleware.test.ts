import { describe, it, expect, vi } from 'vitest';
import { middleware } from '../middleware/roleMiddleware';
import { NextRequest } from 'next/server';

// Mock jose
vi.mock('jose', () => ({
  jwtVerify: vi.fn(),
}));

describe('Auth Middleware', () => {
  it('should redirect if no token is present', async () => {
    const req = new NextRequest('http://localhost/dashboard');
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost/login');
  });

  // Note: Testing middleware fully with mocked JWT verification is complex in this environment
  // due to edge runtime constraints and mocking `jose`.
  // For now, we verify the basic redirection logic.
});
