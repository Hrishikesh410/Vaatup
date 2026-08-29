import { formatMoney, INR, parseMoney, toInputValue, toMinorUnits } from '@/utils/currency';

describe('formatMoney', () => {
  it('hides decimals for whole amounts and groups Indian-style', () => {
    expect(formatMoney(246_000)).toBe('₹2,460');
    expect(formatMoney(100_000_000)).toBe('₹10,00,000');
    expect(formatMoney(0)).toBe('₹0');
  });

  it('shows decimals only when there are paise', () => {
    expect(formatMoney(33_334)).toBe('₹333.34');
    expect(formatMoney(5)).toBe('₹0.05');
  });

  it('can be forced to show decimals or drop the symbol', () => {
    expect(formatMoney(246_000, INR, { alwaysShowDecimals: true })).toBe('₹2,460.00');
    expect(formatMoney(246_000, INR, { hideSymbol: true })).toBe('2,460');
  });

  it('keeps the sign outside the symbol', () => {
    expect(formatMoney(-12_000)).toBe('-₹120');
  });

  it('follows a different currency configuration', () => {
    const usd = {
      code: 'USD',
      symbol: '$',
      minorUnitDigits: 2,
      locale: 'en-US',
    };
    expect(formatMoney(123_456_789, usd)).toBe('$1,234,567.89');
  });
});

describe('parseMoney', () => {
  it('parses plain and decorated input', () => {
    expect(parseMoney('2460')).toBe(246_000);
    expect(parseMoney('₹2,460')).toBe(246_000);
    expect(parseMoney('333.34')).toBe(33_334);
    expect(parseMoney('0.5')).toBe(50);
    expect(parseMoney('.5')).toBe(50);
  });

  it('rounds beyond the smallest unit', () => {
    expect(parseMoney('1.005')).toBe(101);
    expect(parseMoney('1.004')).toBe(100);
  });

  it('rejects anything that is not a plain amount', () => {
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('1.2.3')).toBeNull();
    expect(parseMoney('-5')).toBeNull();
  });
});

describe('toMinorUnits and toInputValue', () => {
  it('round-trips an editable value', () => {
    expect(toMinorUnits(2460)).toBe(246_000);
    expect(toInputValue(246_000)).toBe('2460');
    expect(toInputValue(33_334)).toBe('333.34');
    expect(toInputValue(0)).toBe('');
  });
});
