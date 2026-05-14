'use client';

import { useEffect, useState } from 'react';

type HandoffRole = 'demo' | 'test';

export function AdminHandoffButtons() {
  const [canImpersonate, setCanImpersonate] = useState(false);
  const [busy, setBusy] = useState<HandoffRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setCanImpersonate(!!j.canImpersonate);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!canImpersonate) return null;

  async function open(role: HandoffRole) {
    setError(null);
    setBusy(role);
    try {
      const res = await fetch('/api/admin/handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ as: role }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Failed (${res.status})`);
        return;
      }
      const { url } = await res.json();
      // New tab: the impersonation cookie slot is set in the same browser
      // session, so the opened tab inherits it. The admin's primary tab
      // (which made the POST) keeps using /dashboard with no impersonation
      // because Referer detection only fires for /as/<role>/ paths.
      window.open(url, '_blank', 'noopener');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => open('demo')}
        disabled={!!busy}
        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        title="Open the demo user's dashboard in a new tab"
      >
        {busy === 'demo' ? 'Opening…' : 'Open Demo'}
      </button>
      <button
        type="button"
        onClick={() => open('test')}
        disabled={!!busy}
        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        title="Open the test user's dashboard in a new tab"
      >
        {busy === 'test' ? 'Opening…' : 'Open Test'}
      </button>
      {error && (
        <span role="alert" className="text-xs text-rose-600">
          {error}
        </span>
      )}
    </div>
  );
}
