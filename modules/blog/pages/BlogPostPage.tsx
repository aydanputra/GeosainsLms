"use client";

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import PostDetail from '../components/PostDetail';

export default function BlogPostPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const { data: post, isLoading, error } = useQuery({
    queryKey: ['blog-post', slug],
    queryFn: async () => {
      if (!slug) return null;
      const res = await fetch(`/api/blog/posts/${slug}`);
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error('Failed to fetch post');
      }
      return res.json();
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 animate-pulse">
        <div className="h-12 bg-gray-200 rounded mb-4 w-3/4 mx-auto"></div>
        <div className="h-4 bg-gray-200 rounded mb-12 w-1/3 mx-auto"></div>
        <div className="space-y-4">
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-20 text-red-600">Failed to load post.</div>;
  }

  if (!post) {
    return <div className="text-center py-20 text-gray-500">Post not found.</div>;
  }

  return <PostDetail post={post} />;
}
