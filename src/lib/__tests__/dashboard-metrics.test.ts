import { formatCurrency, computeCashGrowthMoM } from '@/lib/dashboard-metrics';

describe('formatCurrency', () => {
  it('formats positive integers as USD with no fractional digits', () => {
    expect(formatCurrency(10000)).toBe('$10,000');
  });

  it('formats zero as $0', () => {
    expect(formatCurrency(0)).toBe('$0');
  });

  it('rounds fractional amounts to the nearest integer', () => {
    expect(formatCurrency(1234.6)).toBe('$1,235');
  });

  it('formats large numbers with thousands separators', () => {
    expect(formatCurrency(1234567)).toBe('$1,234,567');
  });

  it('formats negative values', () => {
    expect(formatCurrency(-5000)).toBe('-$5,000');
  });
});

describe('computeCashGrowthMoM', () => {
  it('returns 0 when both current and previous net are zero', () => {
    expect(computeCashGrowthMoM(0, 0, 0, 0)).toBe(0);
  });

  it('returns null when previous net is zero and current net is positive', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(computeCashGrowthMoM(5000, 0, 1000, 1000)).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('returns null when previous net is zero and current net is negative', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(computeCashGrowthMoM(0, 500, 1000, 1000)).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('computes positive growth when current net exceeds previous net', () => {
    expect(computeCashGrowthMoM(5000, 3000, 4000, 3000)).toBe(100);
  });

  it('computes negative growth when current net is below previous net', () => {
    expect(computeCashGrowthMoM(4000, 3000, 5000, 3000)).toBe(-50);
  });

  it('reports improvement when burn shrinks (previousNet < 0, currentNet less negative)', () => {
    expect(computeCashGrowthMoM(500, 1000, 0, 1000)).toBe(50);
  });

  it('reports worsening when burn deepens (previousNet < 0, currentNet more negative)', () => {
    expect(computeCashGrowthMoM(0, 2000, 0, 1000)).toBe(-100);
  });

  it('preserves sign across a flip from positive to negative net', () => {
    expect(computeCashGrowthMoM(0, 500, 1500, 500)).toBe(-150);
  });
});
