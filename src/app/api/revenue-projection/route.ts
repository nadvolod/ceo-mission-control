import { NextRequest, NextResponse } from 'next/server';
import { RevenueProjectionService } from '@/lib/revenue-projection';
import { checkAuth } from '@/lib/auth';
import { loadJSON } from '@/lib/storage';
import type { AdjustmentType } from '@/lib/types';

const VALID_TYPES = new Set<AdjustmentType>(['revenue_gain', 'revenue_loss', 'expense_increase', 'expense_decrease']);
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function validateAmount(amount: unknown): number | null {
  const n = Number(amount);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function validateBaseAmount(amount: unknown): number | null {
  if (amount === null) return null;
  const n = Number(amount);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

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
        if (!effectiveMonth || !MONTH_RE.test(effectiveMonth)) {
          return NextResponse.json({ error: 'Invalid effectiveMonth (expected YYYY-MM)' }, { status: 400 });
        }
        const validAmount = validateAmount(amount);
        if (validAmount === null) {
          return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
        }
        if (!type || !VALID_TYPES.has(type)) {
          return NextResponse.json({ error: `Invalid type. Must be one of: ${[...VALID_TYPES].join(', ')}` }, { status: 400 });
        }
        if (!description || typeof description !== 'string' || !description.trim()) {
          return NextResponse.json({ error: 'Description is required' }, { status: 400 });
        }
        const adj = await service.addAdjustment({
          effectiveMonth,
          amount: validAmount,
          description: description.trim(),
          type,
          recurring: recurring ?? false,
        });
        return NextResponse.json({ adjustment: adj, data: service.getData() });
      }

      case 'updateAdjustment': {
        const { id, ...updates } = data;
        // Validate provided fields
        const sanitized: Record<string, unknown> = {};
        if ('effectiveMonth' in updates) {
          if (!updates.effectiveMonth || !MONTH_RE.test(updates.effectiveMonth)) {
            return NextResponse.json({ error: 'Invalid effectiveMonth (expected YYYY-MM)' }, { status: 400 });
          }
          sanitized.effectiveMonth = updates.effectiveMonth;
        }
        if ('amount' in updates) {
          const valid = validateAmount(updates.amount);
          if (valid === null) {
            return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
          }
          sanitized.amount = valid;
        }
        if ('type' in updates) {
          if (!updates.type || !VALID_TYPES.has(updates.type)) {
            return NextResponse.json({ error: `Invalid type` }, { status: 400 });
          }
          sanitized.type = updates.type;
        }
        if ('description' in updates) {
          if (!updates.description || typeof updates.description !== 'string' || !updates.description.trim()) {
            return NextResponse.json({ error: 'Description is required' }, { status: 400 });
          }
          sanitized.description = updates.description.trim();
        }
        if ('recurring' in updates) {
          sanitized.recurring = Boolean(updates.recurring);
        }
        const adj = await service.updateAdjustment(id, sanitized);
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
        if (data.amount !== null) {
          const valid = validateBaseAmount(data.amount);
          if (valid === null) {
            return NextResponse.json({ error: 'Amount must be a non-negative number or null' }, { status: 400 });
          }
          await service.setBaseIncome(valid);
        } else {
          await service.setBaseIncome(null);
        }
        return NextResponse.json({ data: service.getData() });
      }

      case 'setBaseExpenses': {
        if (data.amount !== null) {
          const valid = validateBaseAmount(data.amount);
          if (valid === null) {
            return NextResponse.json({ error: 'Amount must be a non-negative number or null' }, { status: 400 });
          }
          await service.setBaseExpenses(valid);
        } else {
          await service.setBaseExpenses(null);
        }
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
