import { notFound, redirect } from 'next/navigation';
import HomePage from '@/app/dashboard/page';
import { getOptionalSession } from '@/lib/session';
import { ImpersonationBanner } from '@/components/ImpersonationBanner';

const ALLOWED_ROLES = new Set(['demo', 'test']);

interface PageProps {
  params: Promise<{ role: string }>;
}

export default async function AsRoleDashboard({ params }: PageProps) {
  const { role } = await params;
  if (!ALLOWED_ROLES.has(role)) {
    notFound();
  }

  const session = await getOptionalSession();
  // Must be admin AND admin must have already opened this role via the
  // handoff endpoint. Direct navigation to /as/demo/... by a non-admin
  // or by an admin who hasn't initiated impersonation gets bounced.
  if (!session?.adminId || !session.impersonating?.[role as 'demo' | 'test']) {
    redirect('/dashboard');
  }

  // The existing dashboard component is client-side; data hooks call
  // /api/*. Those API routes detect the /as/<role>/ prefix via the
  // Referer header and resolve the impersonated user automatically —
  // no special client wiring needed here.
  return (
    <>
      <ImpersonationBanner role={role as 'demo' | 'test'} />
      <HomePage />
    </>
  );
}
