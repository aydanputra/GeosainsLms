"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Post {
  id: string;
  title: string;
  slug: string;
  content: string;
  publishedAt: string;
  author: {
    name: string;
  };
}

export default function PostList() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/blog/posts')
      .then((res) => res.json())
      .then((data) => {
        setPosts(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading posts...</div>;

  return (
    <div className="space-y-6">
      {posts.map((post) => (
        <div key={post.id} className="border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <Link href={`/blog/${post.slug}`} className="block">
            <h2 className="text-2xl font-bold mb-2 hover:text-indigo-600">{post.title}</h2>
          </Link>
          <div className="text-sm text-gray-500 mb-4">
            <span>By {post.author.name}</span>
            <span className="mx-2">•</span>
            <span>{new Date(post.publishedAt).toLocaleDateString()}</span>
          </div>
          <p className="text-gray-600 line-clamp-3">{post.content.substring(0, 200)}...</p>
          <Link href={`/blog/${post.slug}`} className="text-indigo-600 mt-4 inline-block font-medium">
            Read more &rarr;
          </Link>
        </div>
      ))}
      {posts.length === 0 && <p>No posts found.</p>}
    </div>
  );
}
