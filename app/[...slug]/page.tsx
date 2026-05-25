"use client";

import { useQuery } from '@tanstack/react-query';
import { useParams, notFound } from 'next/navigation';
import PageRenderer from '../../modules/pages/components/PageRenderer';

export default function DynamicPage() {
  const params = useParams();
  const slug = params?.slug as string[];
  const slugString = slug?.join('/') || '';

  const { data: page, isLoading, error } = useQuery({
    queryKey: ['page', slugString],
    queryFn: async () => {
      if (!slugString) return null;
      // We need a public endpoint for fetching pages by slug without ID
      // Let's assume we create /api/pages/public/[...slug] or similar
      // For now reusing the existing ID-based one if slug is treated as ID in backend logic (it is in our service.ts)
      const res = await fetch(`/api/pages/${slugString}`); 
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error('Failed to fetch page');
      }
      return res.json();
    },
    enabled: !!slugString,
  });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  
  if (error) return <div className="min-h-screen flex items-center justify-center text-red-500">Error loading page</div>;

  if (!page) return notFound();

  return <PageRenderer blocks={page.blocks || []} />;
}
