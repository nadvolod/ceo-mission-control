import { NextRequest, NextResponse } from 'next/server';
import { getFinancialSnapshot, getCachedSnapshot } from '@/lib/monarch-service';
import { requireEffectiveUserId, isRealAdminRequest } from '@/lib/session';

// Monarch uses a single global MONARCH_TOKEN. A demo or test user with an
// empty cache could otherwise trigger a fresh fetch and store admin's real
// financial accounts under their own owner_id. Until per-user Monarch
// credentials exist, gate this route to the real admin (not impersonated).
async function guard(request: NextRequest): Promise<NextResponse | null> {
  if (!process.env.MONARCH_TOKEN) {
    return NextResponse.json(
      { error: 'Monarch Money not configured. Set MONARCH_TOKEN environment variable.' },
      { status: 503 },
    );
  }
  if (!(await isRealAdminRequest(request))) {
    return NextResponse.json(
      { error: 'Monarch data is admin-only until per-user credentials are supported.' },
      { status: 403 },
    );
  }
  return null;
}

export async function GET(request: NextRequest) {
  const blocked = await guard(request);
  if (blocked) return blocked;

  try {
    const ownerId = await requireEffectiveUserId(request);
    const snapshot = await getFinancialSnapshot(ownerId);
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error('Error fetching Monarch data:', error);

    // Try to serve stale cache on error
    try {
      const ownerId = await requireEffectiveUserId(request);
      const stale = await getCachedSnapshot(ownerId);
      if (stale) {
        return NextResponse.json({ ...stale, stale: true });
      }
    } catch (cacheError) {
      console.error('Error reading cached Monarch data:', cacheError);
    }

    return NextResponse.json(
      { error: 'Failed to fetch financial data from Monarch Money' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const blocked = await guard(request);
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'refresh': {
        const ownerId = await requireEffectiveUserId(request);
        const snapshot = await getFinancialSnapshot(ownerId, true);
        return NextResponse.json(snapshot);
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error processing Monarch request:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
