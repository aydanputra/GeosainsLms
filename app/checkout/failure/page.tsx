"use client";

import Link from 'next/link';

export default function CheckoutFailurePage() {
  return (
    <div className="max-w-md mx-auto px-4 py-20 text-center">
      <div className="bg-red-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Payment Failed</h1>
      <p className="text-gray-600 mb-8">
        We could not process your payment. Please try again or contact support if the problem persists.
      </p>
      <div className="space-x-4">
        <Link
          href="/checkout"
          className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
        >
          Try Again
        </Link>
        <Link
          href="/shop"
          className="inline-block bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
        >
          Back to Shop
        </Link>
      </div>
    </div>
  );
}
