import { INR } from '@/utils/currency';
import {
  buildUpiUri,
  isValidVpa,
  normalizeVpa,
  sanitizePayeeName,
  supportsUpi,
  upiCollectLine,
  upiNote,
} from '@/utils/upi';

const collector = { vpa: 'asha@okhdfcbank', name: 'Asha Menon' };

describe('isValidVpa', () => {
  it.each([
    'asha@okhdfcbank',
    '9876543210@ybl',
    'asha.menon@oksbi',
    'asha_menon@paytm',
    'asha-menon@axl',
    'ASHA@OKAXIS',
    ' asha@upi ',
  ])('accepts %s', (value) => {
    expect(isValidVpa(value)).toBe(true);
  });

  it.each([
    '',
    'asha',
    '@okhdfcbank',
    'asha@',
    'asha@@okhdfcbank',
    'asha@1bank',
    'asha@b',
    'asha menon@oksbi',
    'asha..menon@oksbi',
    '.asha@oksbi',
    'asha.@oksbi',
    'asha@okhdfc bank',
    'asha@ok!bank',
  ])('rejects %s', (value) => {
    expect(isValidVpa(value)).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isValidVpa(undefined)).toBe(false);
  });
});

describe('normalizeVpa', () => {
  it('trims and lowercases, because VPAs are case-insensitive', () => {
    expect(normalizeVpa('  Asha@OkHdfcBank  ')).toBe('asha@okhdfcbank');
  });
});

describe('sanitizePayeeName', () => {
  it('keeps letters, numbers and single spaces', () => {
    expect(sanitizePayeeName('Asha  Menon')).toBe('Asha Menon');
  });

  it('strips punctuation that some PSPs reject', () => {
    expect(sanitizePayeeName('Asha (Flat #3) & co.')).toBe('Asha Flat 3 co');
  });

  it('keeps non-Latin scripts', () => {
    expect(sanitizePayeeName('आशा मेनन')).toBe('आशा मेनन');
  });

  it('caps the length', () => {
    expect(sanitizePayeeName('a'.repeat(80))).toHaveLength(50);
  });
});

describe('upiNote', () => {
  it('falls back when the bill has no name', () => {
    expect(upiNote('   ')).toBe('Bill split');
  });

  it('cleans and shortens a long name', () => {
    expect(upiNote('Dinner at Toit!')).toBe('Dinner at Toit');
    expect(upiNote('x'.repeat(60))).toHaveLength(40);
  });
});

describe('buildUpiUri', () => {
  it('emits the standard parameters', () => {
    const uri = buildUpiUri({
      collector,
      amount: 90200,
      note: 'Dinner at Toit',
    });
    expect(uri).toBe(
      'upi://pay?pa=asha%40okhdfcbank&pn=Asha%20Menon&am=902.00&cu=INR&tn=Dinner%20at%20Toit'
    );
  });

  it('always sends a two-decimal amount, never a grouped one', () => {
    expect(buildUpiUri({ collector, amount: 123456789 })).toContain('am=1234567.89');
    expect(buildUpiUri({ collector, amount: 100000 })).toContain('am=1000.00');
    expect(buildUpiUri({ collector, amount: 1 })).toContain('am=0.01');
  });

  it('omits the note when there is nothing useful to say', () => {
    expect(buildUpiUri({ collector, amount: 5000 })).not.toContain('tn=');
  });

  it('normalizes the address', () => {
    const uri = buildUpiUri({
      collector: { vpa: ' Asha@OKSBI ', name: 'Asha' },
      amount: 5000,
    });
    expect(uri).toContain('pa=asha%40oksbi');
  });

  it('drops an unusable payee name rather than sending punctuation', () => {
    const uri = buildUpiUri({
      collector: { vpa: 'asha@oksbi', name: '!!!' },
      amount: 5000,
    });
    expect(uri).not.toContain('pn=');
  });
});

describe('upiCollectLine', () => {
  it('names the amount and the address', () => {
    expect(upiCollectLine(collector, 90200)).toBe('💸 Pay ₹902 to asha@okhdfcbank (any UPI app)');
  });

  it('shows paise when there are any', () => {
    expect(upiCollectLine(collector, 90233)).toContain('₹902.33');
  });
});

describe('supportsUpi', () => {
  it('is rupees only', () => {
    expect(supportsUpi(INR)).toBe(true);
    expect(
      supportsUpi({
        code: 'USD',
        symbol: '$',
        minorUnitDigits: 2,
        locale: 'en-US',
      })
    ).toBe(false);
  });
});
