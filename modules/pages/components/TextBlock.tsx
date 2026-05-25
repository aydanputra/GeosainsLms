"use client";

interface TextBlockProps {
  content: {
    text: string;
    alignment?: 'left' | 'center' | 'right';
  };
}

export default function TextBlock({ content }: TextBlockProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div 
        className={`prose prose-lg max-w-none ${
          content.alignment === 'center' ? 'text-center' : 
          content.alignment === 'right' ? 'text-right' : 'text-left'
        }`}
        dangerouslySetInnerHTML={{ __html: content.text || '' }}
      />
    </div>
  );
}
