import { NextRequest, NextResponse } from 'next/server';
import { RevenueProjectionService } from '@/lib/revenue-projection';
import { checkAuth } from '@/lib/auth';
import { loadJSON } from '@/lib/storage';

export async function GET() {
  try {
    const service = await RevenueProjectionService.create();
    const data = service.getData();

    // Get Monarch base values for projection computation
    const monarchCache = await loadJSON<{
      cashPosition?: number;
      monthlyIncome?: number;
      monthlyExpenses?: number;
    } | null>('monarch-financial-data.json', null);

    const monarchIncome = monarchCache?.monthlyIncome ?? 0;
    const monarchExpenses = monarchCache?.monthlyExpenses ?? 0;
    const cashPosition = monarchCache?.cashPosition ?? 0;

    const now = new Date();
    const startMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const endMonth = `${now.getFullYear()}-12`;

    const projections = service.computeProjections(
      monarchIncome,
      monarchExpenses,
      cashPosition,
      startMonth,
      endMonth
    );

    return NextResponse.json({
      data,
      projections,
      monarchBase: {
        income: monarchIncome,
        expenses: monarchExpenses,
        cashPosition,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching revenue projections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch revenue projections' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const service = await RevenueProjectionService.create();
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'addAdjustment': {
        const { effectiveMonth, amount, description, type, recurring } = data;
        const adj = await service.addAdjustment({
          effectiveMonth,
          amount,
          description,
          type,
          recurring: recurring ?? false,
        });
        return NextResponse.json({ adjustment: adj, data: service.getData() });
      }

      case 'updateAdjustment': {
        const { id, ...updates } = data;
        const adj = await service.updateAdjustment(id, updates);
        if (!adj) {
          return NextResponse.json({ error: 'Adjustment not found' }, { status: 404 });
        }
        return NextResponse.json({ adjustment: adj, data: service.getData() });
      }

      case 'removeAdjustment': {
        const removed = await service.removeAdjustment(data.id);
        if (!removed) {
          return NextResponse.json({ error: 'Adjustment not found' }, { status: 404 });
        }
        return NextResponse.json({ success: true, data: service.getData() });
      }

      case 'setBaseIncome': {
        await service.setBaseIncome(data.amount);
        return NextResponse.json({ data: service.getData() });
      }

      case 'setBaseExpenses': {
        await service.setBaseExpenses(data.amount);
        return NextResponse.json({ data: service.getData() });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error processing revenue projection request:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
