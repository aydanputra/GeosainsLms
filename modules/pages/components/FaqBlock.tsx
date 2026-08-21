"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';

type FaqItem = {
  question?: string;
  answer?: string;
};

type FaqContent = {
  heading?: string;
  subheading?: string;
  items?: FaqItem[];
  cta?: { text?: string; href?: string };
};

export default function FaqBlock({ content }: { content: FaqContent }) {
  const rawHeading = typeof content?.heading === 'string' ? content.heading.trim() : '';
  const heading = !rawHeading || rawHeading === 'Frequently Asked Questions' ? 'Pertanyaan yang Sering Diajukan' : rawHeading;
  const subheading = typeof content?.subheading === 'string' ? content.subheading : '';
  const items = useMemo(() => (Array.isArray(content?.items) ? content.items : []).filter((it) => it?.question || it?.answer), [content]);
  const ctaText = typeof content?.cta?.text === 'string' ? content.cta.text : '';
  const ctaHref = typeof content?.cta?.href === 'string' ? content.cta.href : '';

  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="w-full bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="text-center">
          <h2 className="text-2xl sm:text-3xl font-[700] leading-[36px] text-slate-900">{heading}</h2>
          {subheading ? <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">{subheading}</p> : null}
          {ctaText && ctaHref ? (
            <div className="mt-6">
              <Link
                href={ctaHref}
                className="inline-flex items-center justify-center px-5 py-3 rounded-2xl bg-brand-gradient text-white font-extrabold text-sm hover:opacity-90 transition-opacity"
              >
                {ctaText}
              </Link>
            </div>
          ) : null}
        </div>

        <div className="mt-10 space-y-3">
          {items.length > 0 ? (
            items.map((it, idx) => {
              const q = typeof it.question === 'string' ? it.question : '';
              const a = typeof it.answer === 'string' ? it.answer : '';
              const isOpen = openIndex === idx;

              return (
                <div key={`${q}-${idx}`} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenIndex((prev) => (prev === idx ? null : idx))}
                    className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left"
                  >
                    <div className="text-sm sm:text-base font-[700] leading-[27px] text-slate-900">{q}</div>
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`${isOpen ? 'block' : 'hidden'} px-5 pb-5`}>
                    <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{a}</div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500">
              Belum ada pertanyaan yang ditambahkan.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
