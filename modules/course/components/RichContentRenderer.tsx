"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import { useEffect } from 'react';

interface RichContentRendererProps {
  content: string | object;
  className?: string;
}

export default function RichContentRenderer({ content, className }: RichContentRendererProps) {
  const editorClassName = [
    'max-w-none',
    'focus:outline-none',
    'text-slate-900',
    'leading-relaxed',
    '[&_p]:text-slate-800',
    '[&_p]:leading-relaxed',
    '[&_p]:my-3',
    '[&_h1]:text-slate-900',
    '[&_h1]:font-extrabold',
    '[&_h1]:my-4',
    '[&_h2]:text-slate-900',
    '[&_h2]:font-extrabold',
    '[&_h2]:my-4',
    '[&_h3]:text-slate-900',
    '[&_h3]:font-bold',
    '[&_h3]:my-3',
    '[&_ul]:list-disc',
    '[&_ul]:pl-6',
    '[&_ul]:my-3',
    '[&_ol]:list-decimal',
    '[&_ol]:pl-6',
    '[&_ol]:my-3',
    '[&_li]:text-slate-800',
    '[&_a]:text-indigo-600',
    '[&_a]:font-semibold',
    '[&_a]:underline',
    '[&_a]:underline-offset-2',
    'hover:[&_a]:text-indigo-700',
    '[&_blockquote]:border-l-4',
    '[&_blockquote]:border-slate-200',
    '[&_blockquote]:pl-4',
    '[&_blockquote]:py-1',
    '[&_blockquote]:my-3',
    '[&_blockquote]:text-slate-700',
    '[&_code]:text-slate-900',
    '[&_code]:bg-slate-100',
    '[&_code]:px-1',
    '[&_code]:py-0.5',
    '[&_code]:rounded',
    '[&_img]:rounded-xl',
    '[&_img]:border',
    '[&_img]:border-slate-200',
    '[&_img]:w-full',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      Image,
      Link.configure({
        openOnClick: true,
        autolink: true,
        HTMLAttributes: {
            target: '_blank',
            rel: 'noopener noreferrer',
            class: 'text-indigo-600 hover:underline',
        }
      }),
    ],
    content: content,
    editable: false,
    editorProps: {
      attributes: {
        class: editorClassName,
      },
    },
  });

  useEffect(() => {
    if (editor && content) {
       // simple check to avoid unnecessary updates
       // This is not perfect but sufficient for read-only
       const currentHTML = editor.getHTML();
       if (typeof content === 'string' && content !== currentHTML) {
           // Basic check: if strictly different. 
           // Note: editor.getHTML() might reorder attributes.
           // Ideally we trust the parent to not pass new content unless it changed.
           editor.commands.setContent(content);
       } else if (typeof content === 'object') {
           editor.commands.setContent(content);
       }
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  return <EditorContent editor={editor} />;
}
