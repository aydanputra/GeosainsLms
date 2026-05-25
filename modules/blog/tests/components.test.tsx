import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PostCard from '../components/PostCard';
import PostDetail from '../components/PostDetail';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children }: any) => <a href={href}>{children}</a>,
}));

describe('Blog Components', () => {
  const mockPost = {
    id: '1',
    title: 'Test Post',
    slug: 'test-post',
    content: '<p>This is a test post content.</p>',
    publishedAt: '2023-01-01T00:00:00.000Z',
    author: {
      name: 'Test Author',
    },
  };

  describe('PostCard', () => {
    it('should render post summary correctly', () => {
      render(<PostCard post={mockPost} />);
      expect(screen.getByText('Test Post')).toBeDefined();
      expect(screen.getByText('Test Author')).toBeDefined();
      expect(screen.getByText('Read more')).toBeDefined();
    });

    it('should format date correctly', () => {
      render(<PostCard post={mockPost} />);
      expect(screen.getByText('January 1, 2023')).toBeDefined();
    });
  });

  describe('PostDetail', () => {
    it('should render full post content', () => {
      render(<PostDetail post={mockPost} />);
      expect(screen.getByText('Test Post')).toBeDefined();
      expect(screen.getByText('This is a test post content.')).toBeDefined();
      const authorElements = screen.getAllByText('Test Author');
      expect(authorElements.length).toBeGreaterThan(0);
    });
  });
});
