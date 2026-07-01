import {
  formatCurrency,
  formatCurrencyCompact,
  formatRunway,
  computeCashGrowthMoM,
  computeCashMoMDelta,
  computeTotalFocusHoursThisWeek,
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
  // Args: (monthlyIncome, monthlyExpenses, optional savingsRate).
  // Reports Monarch cashflow growth percent. savingsRate may arrive as a
  // ratio (0.752) or already-normalized percent (75.2).

  it('returns 0 when income and expenses are both 0', () => {
    expect(computeCashGrowthMoM(0, 0)).toBe(0);
  });

  it('normalizes Monarch savingsRate ratios to percent', () => {
    expect(computeCashGrowthMoM(25_851, 6_411, 0.752)).toBeCloseTo(75.2);
  });

  it('passes through Monarch savingsRate values that are already percent', () => {
    expect(computeCashGrowthMoM(25_851, 6_411, 75.2)).toBeCloseTo(75.2);
  });

  it('returns null when income is 0 and expenses are non-zero', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(computeCashGrowthMoM(0, 2000)).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('falls back to net cashflow divided by income when savingsRate is absent', () => {
    expect(computeCashGrowthMoM(10_000, 2_480)).toBeCloseTo(75.2);
  });

  it('matches the Monarch worked example: $19,440 growth at 75.2%', () => {
    const result = computeCashGrowthMoM(25_851, 6_411, 0.752);
    expect(result).not.toBeNull();
    expect(result!).toBeCloseTo(75.2, 1);
  });
});

describe('computeCashMoMDelta', () => {
  // Args: (monthlyIncome, monthlyExpenses). Returns the dollar change in cash
  // position for the month (i.e. income − expenses).

  it('returns positive delta for a profitable month when savings is absent', () => {
    expect(computeCashMoMDelta(5_000, 3_000)).toBe(2_000);
  });

  it('uses Monarch savings when provided', () => {
    expect(computeCashMoMDelta(25_851, 6_411, 19_440)).toBe(19_440);
  });

  it('returns negative delta for a burn month', () => {
    expect(computeCashMoMDelta(3_000, 5_000)).toBe(-2_000);
  });

  it('returns zero when income equals expenses', () => {
    expect(computeCashMoMDelta(5_000, 5_000)).toBe(0);
  });

  it('returns zero when both inputs are zero', () => {
    expect(computeCashMoMDelta(0, 0)).toBe(0);
  });
});

describe('computeTotalFocusHoursThisWeek', () => {
  it('returns 0 when both inputs are missing', () => {
    expect(computeTotalFocusHoursThisWeek(null, null)).toBe(0);
    expect(computeTotalFocusHoursThisWeek(undefined, undefined)).toBe(0);
  });

  it('sums all focus session categories', () => {
    expect(
      computeTotalFocusHoursThisWeek(
        { Temporal: 3.5, Finance: 2, Revenue: 1.5 },
        0,
      ),
    ).toBe(7);
  });

  it('adds weekly tracker deep work hours to the session sum', () => {
    expect(
      computeTotalFocusHoursThisWeek({ Temporal: 3.5 }, 4.5),
    ).toBe(8);
  });

  it('falls back to 0 for non-finite hour values inside the totals map', () => {
    expect(
      computeTotalFocusHoursThisWeek(
        { Temporal: 3.5, Bad: Number.NaN, Worse: Number.POSITIVE_INFINITY },
        null,
      ),
    ).toBe(3.5);
  });

  it('falls back to 0 for non-finite deepWorkTotal', () => {
    expect(
      computeTotalFocusHoursThisWeek({ Temporal: 2 }, Number.NaN),
    ).toBe(2);
  });
});
