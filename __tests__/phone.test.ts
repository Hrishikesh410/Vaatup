import { isValidPhoneNumber, normalizePhoneNumber } from '@/utils/phone';

describe('normalizePhoneNumber', () => {
  it('adds the default country code to a local number', () => {
    expect(normalizePhoneNumber('9876543210')).toEqual({
      ok: true,
      digits: '919876543210',
      e164: '+919876543210',
    });
  });

  it('accepts an already international number', () => {
    expect(normalizePhoneNumber('+919876543210')).toMatchObject({
      digits: '919876543210',
    });
    expect(normalizePhoneNumber('00919876543210')).toMatchObject({
      digits: '919876543210',
    });
    expect(normalizePhoneNumber('919876543210')).toMatchObject({
      digits: '919876543210',
    });
  });

  it('ignores spaces, dashes and brackets', () => {
    expect(normalizePhoneNumber('+91 98765-43210')).toMatchObject({
      digits: '919876543210',
    });
    expect(normalizePhoneNumber('(987) 654 3210')).toMatchObject({
      digits: '919876543210',
    });
  });

  it('strips a trunk prefix', () => {
    expect(normalizePhoneNumber('09876543210')).toMatchObject({
      digits: '919876543210',
    });
  });

  it('reports missing input separately from bad input', () => {
    expect(normalizePhoneNumber(undefined)).toEqual({
      ok: false,
      reason: 'empty',
    });
    expect(normalizePhoneNumber('   ')).toEqual({ ok: false, reason: 'empty' });
    expect(normalizePhoneNumber('12345')).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(normalizePhoneNumber('98765432101234567890')).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('keeps a foreign number typed with its own country code', () => {
    expect(normalizePhoneNumber('+14155552671')).toMatchObject({
      digits: '14155552671',
    });
  });

  it('falls back to the default country for an unknown country code', () => {
    expect(normalizePhoneNumber('9876543210', 'ZZ')).toMatchObject({
      digits: '919876543210',
    });
  });
});

describe('isValidPhoneNumber', () => {
  it('is a thin convenience over normalization', () => {
    expect(isValidPhoneNumber('9876543210')).toBe(true);
    expect(isValidPhoneNumber('12345')).toBe(false);
    expect(isValidPhoneNumber(undefined)).toBe(false);
  });
});
