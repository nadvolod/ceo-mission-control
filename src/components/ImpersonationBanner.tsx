'use client';

import Link from 'next/link';

interface Props {
  role: 'demo' | 'test';
}

export function ImpersonationBanner({ role }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 bg-amber-100 border-b border-amber-300 text-amber-900 px-4 py-2 text-sm flex items-center justify-between"
    >
      <span>
        Viewing as <strong className="font-semibold capitalize">{role}</strong> user.
        Any data you change here writes to the <strong>{role}</strong> account, not your admin.
      </span>
      <Link
        href="/dashboard"
        className="ml-4 inline-flex items-center rounded-md bg-amber-900 px-3 py-1 text-xs font-medium text-white hover:bg-amber-800"
      >
        Return to admin
      </Link>
    </div>
  );
}
