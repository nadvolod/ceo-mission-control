import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getUserByRole } from '@/lib/users';
import { appendAuditLog } from '@/lib/storage';

const ALLOWED_ROLES = ['demo', 'test'] as const;
type HandoffRole = (typeof ALLOWED_ROLES)[number];

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin') || request.headers.get('referer');
  if (!origin) return false;
  try {
    const u = new URL(origin);
    const host = u.host;
    return host === request.headers.get('host');
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  // CSRF guard: only accept calls from the same origin. Browsers send
  // Origin on POSTs from forms / fetch by default. Without this, a third
  // party could trick an admin's browser into firing this endpoint.
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden (origin)' }, { status: 403 });
  }

  const session = await getSession();
  if (!session.adminId) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  let body: { as?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const as = body.as;
  if (typeof as !== 'string' || !ALLOWED_ROLES.includes(as as HandoffRole)) {
    return NextResponse.json(
      { error: `as must be one of: ${ALLOWED_ROLES.join(', ')}` },
      { status: 400 },
    );
  }

  const target = await getUserByRole(as as HandoffRole);
  if (!target) {
    return NextResponse.json(
      { error: `${as} user is not seeded — run db:migrate` },
      { status: 503 },
    );
  }

  session.impersonating = { ...(session.impersonating || {}), [as]: target.id };
  await session.save();

  // Forensic trail under the admin's id — who acted, plus the target.
  await appendAuditLog(
    session.adminId,
    new Date().toISOString().slice(0, 10),
    'admin-handoff',
    `admin opened /as/${as} (target=${target.id})`,
  );

  return NextResponse.json({ ok: true, url: `/as/${as}/dashboard` });
}
