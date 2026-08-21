import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PageRenderer from '../components/PageRenderer';

// Mock child components to simplify testing
vi.mock('../components/HeroBlock', () => ({
  default: ({ content }: any) => <div>Hero: {content.heading}</div>,
}));
vi.mock('../components/TextBlock', () => ({
  default: ({ content }: any) => <div>Text: {content.text}</div>,
}));

describe('Page Components', () => {
  describe('PageRenderer', () => {
    it('should render blocks correctly', () => {
      const blocks = [
        { id: '1', type: 'HERO', content: JSON.stringify({ heading: 'My Hero' }) },
        { id: '2', type: 'TEXT', content: JSON.stringify({ text: 'Some text' }) },
      ];

      render(<PageRenderer blocks={blocks} />);
      
      expect(screen.getByText('Hero: My Hero')).toBeDefined();
      expect(screen.getByText('Text: Some text')).toBeDefined();
    });

    it('should handle empty blocks', () => {
      render(<PageRenderer blocks={[]} />);
      expect(screen.getByText('Empty Page')).toBeDefined();
    });
  });
});
