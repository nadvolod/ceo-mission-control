import { fmtMetric, clamp } from '../format';

describe('fmtMetric', () => {
  it('renders compact money', () => {
    expect(fmtMetric(35300, 'money')).toBe('$35.3K');
    expect(fmtMetric(500, 'money')).toBe('$500');
  });

  it('renders hours with up to one decimal', () => {
    expect(fmtMetric(2, 'hours')).toBe('2h');
    expect(fmtMetric(1.5, 'hours')).toBe('1.5h');
  });

  it('renders count with the × suffix', () => {
    expect(fmtMetric(4, 'count')).toBe('4×');
  });

  it('renders int as a plain integer (no suffix) — used by Battles Won', () => {
    expect(fmtMetric(0, 'int')).toBe('0');
    expect(fmtMetric(3, 'int')).toBe('3');
    expect(fmtMetric(47, 'int')).toBe('47');
    // Defensive: a fractional value is rounded (toFixed(0)) to an integer string.
    expect(fmtMetric(2.7, 'int')).toBe('3');
  });

  it('returns an em dash for non-finite values', () => {
    expect(fmtMetric(Number.NaN, 'int')).toBe('—');
  });
});

describe('clamp', () => {
  it('clamps to the provided bounds', () => {
    expect(clamp(-1, 0, 1)).toBe(0);
    expect(clamp(2, 0, 1)).toBe(1);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });
});
