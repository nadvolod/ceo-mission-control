import {
  formatCurrency,
  formatCurrencyCompact,
  formatRunway,
  computeCashGrowthMoM,
  computeCashMoMDelta,
} from '@/lib/dashboard-metrics';

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

describe('formatCurrencyCompact', () => {
  it('formats values under 1000 with no suffix', () => {
    expect(formatCurrencyCompact(500)).toBe('$500');
    expect(formatCurrencyCompact(0)).toBe('$0');
  });

  it('formats thousands with K suffix and one decimal', () => {
    expect(formatCurrencyCompact(1500)).toBe('$1.5K');
    expect(formatCurrencyCompact(10000)).toBe('$10.0K');
  });

  it('formats millions with M suffix and two decimals', () => {
    expect(formatCurrencyCompact(2_500_000)).toBe('$2.50M');
    expect(formatCurrencyCompact(1_234_567)).toBe('$1.23M');
  });

  it('preserves sign for negative values', () => {
    expect(formatCurrencyCompact(-1500)).toBe('-$1.5K');
    expect(formatCurrencyCompact(-2_000_000)).toBe('-$2.00M');
  });

  it('treats null and undefined as zero', () => {
    expect(formatCurrencyCompact(null)).toBe('$0');
    expect(formatCurrencyCompact(undefined)).toBe('$0');
  });
});

describe('formatRunway', () => {
  it('formats months under a year with "mo runway"', () => {
    expect(formatRunway(6)).toBe('6.0mo runway');
    expect(formatRunway(11.5)).toBe('11.5mo runway');
  });

  it('formats 12+ months as years with "y runway"', () => {
    expect(formatRunway(12)).toBe('1.0y runway');
    expect(formatRunway(24)).toBe('2.0y runway');
  });

  it('returns "No burn" for negative sentinel', () => {
    expect(formatRunway(-1)).toBe('No burn');
  });

  it('treats null/undefined as 0 months', () => {
    expect(formatRunway(null)).toBe('0.0mo runway');
    expect(formatRunway(undefined)).toBe('0.0mo runway');
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

describe('computeCashMoMDelta', () => {
  it('returns the raw difference between current and previous net', () => {
    expect(computeCashMoMDelta(5000, 3000, 4000, 3000)).toBe(1000);
  });

  it('returns a negative delta when current net is below previous', () => {
    expect(computeCashMoMDelta(4000, 3000, 5000, 3000)).toBe(-1000);
  });

  it('returns zero when nets are equal', () => {
    expect(computeCashMoMDelta(5000, 3000, 5000, 3000)).toBe(0);
  });

  it('handles negative nets (burn periods)', () => {
    expect(computeCashMoMDelta(0, 2000, 0, 1000)).toBe(-1000);
  });
});
