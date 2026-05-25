"use client";

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface CTABlockProps {
  content: {
    heading?: string;
    subheading?: string;
    buttonText?: string;
    buttonLink?: string;
    buttonHref?: string;
  };
}

export default function CTABlock({ content }: CTABlockProps) {
  const buttonText = content.buttonText || 'Mulai';
  const buttonHref = content.buttonHref || content.buttonLink || '/courses';

  return (
    <section className="bg-indigo-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="rounded-3xl bg-indigo-600/60 border border-white/10 px-5 sm:px-10 py-10 sm:py-12 text-center overflow-hidden relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_60%)]" />
          <div className="relative space-y-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              {content.heading || 'Siap mulai belajar?'}
            </h2>
            <p className="text-sm sm:text-base text-indigo-100 max-w-2xl mx-auto">
              {content.subheading || 'Daftar sekarang dan mulai perjalanan belajarmu.'}
            </p>
            <div className="pt-3">
              <Link
                href={buttonHref}
                className="inline-flex items-center justify-center gap-2 bg-white text-indigo-700 font-bold py-3 px-8 rounded-xl hover:bg-indigo-50 transition-colors shadow-lg w-full sm:w-auto"
              >
                {buttonText} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
