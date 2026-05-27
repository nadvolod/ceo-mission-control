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
  // Args: (cashPosition, monthlyIncome, monthlyExpenses).
  // Internally derives previousCashPosition = cashPosition − (income − expenses)
  // and reports the % change in account balance over the current month, to
  // match Monarch's "1 month" view.

  it('returns 0 when current net is 0 and balance is non-zero (flat month)', () => {
    expect(computeCashGrowthMoM(10_000, 0, 0)).toBe(0);
  });

  it('returns 0 when cashPosition and current net are both 0', () => {
    expect(computeCashGrowthMoM(0, 0, 0)).toBe(0);
  });

  it('returns null when derived previous balance is 0 and current net is positive', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    // cashPosition=5000, currentNet=5000 → previousCashPosition=0
    expect(computeCashGrowthMoM(5000, 5000, 0)).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('returns null when derived previous balance is 0 and current net is negative', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    // cashPosition=-2000, currentNet=-2000 → previousCashPosition=0
    expect(computeCashGrowthMoM(-2000, 0, 2000)).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('computes +10% when cash grew by 10% of the starting balance', () => {
    // Start of month: 10,000. Net for month: +1,000. End: 11,000.
    expect(computeCashGrowthMoM(11_000, 1_000, 0)).toBeCloseTo(10);
  });

  it('computes negative growth when this month is a burn', () => {
    // Start: 10,000. Net: -1,000. End: 9,000. Growth: -10%.
    expect(computeCashGrowthMoM(9_000, 0, 1_000)).toBeCloseTo(-10);
  });

  it('handles a recovery month while still in debt (negative starting balance)', () => {
    // Start: -5,000. Net: +2,000. End: -3,000. (2000 / 5000) * 100 = +40%.
    expect(computeCashGrowthMoM(-3_000, 2_000, 0)).toBeCloseTo(40);
  });

  it('handles a deeper-debt month (negative starting balance, more burn)', () => {
    // Start: -5,000. Net: -1,000. End: -6,000. (-1000 / 5000) * 100 = -20%.
    expect(computeCashGrowthMoM(-6_000, 0, 1_000)).toBeCloseTo(-20);
  });

  it('matches the Monarch worked example (≈15.9%) from the original bug report', () => {
    // Reported example: Monarch shows ~+15.9% MoM cash growth. With a starting
    // balance of ~$50,000 and a net for the month of ~+$7,950, the formula
    // should report ≈+15.9%, not the spurious −211.9% the old MoM-of-net
    // formula produced.
    const result = computeCashGrowthMoM(57_950, 7_950, 0);
    expect(result).not.toBeNull();
    expect(result!).toBeCloseTo(15.9, 1);
  });
});

describe('computeCashMoMDelta', () => {
  // Args: (monthlyIncome, monthlyExpenses). Returns the dollar change in cash
  // position for the month (i.e. income − expenses).

  it('returns positive delta for a profitable month', () => {
    expect(computeCashMoMDelta(5_000, 3_000)).toBe(2_000);
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
