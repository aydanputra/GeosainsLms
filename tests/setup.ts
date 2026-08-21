import { createElement } from 'react';
import { afterEach, beforeEach, vi } from 'vitest';

// Global mocks
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => ({
    get: vi.fn(() => null),
  }),
}));

vi.mock('next/image', () => ({
  default: ({ alt, ...props }: any) => createElement('img', { alt: alt || '', ...props }),
}));

beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => '',
  }) as any;
});

afterEach(() => {
  vi.clearAllMocks();
});
