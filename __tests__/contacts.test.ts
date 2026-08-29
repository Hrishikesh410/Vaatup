import { preferredNumber } from '@/utils/contacts';

describe('preferredNumber', () => {
  it('has nothing to offer for a contact with no numbers', () => {
    expect(preferredNumber([])).toBeUndefined();
  });

  it('takes the only number there is', () => {
    expect(preferredNumber([{ number: '9876543210' }])).toBe('9876543210');
  });

  it('prefers the mobile over a landline saved first', () => {
    expect(
      preferredNumber([
        { number: '9123456780', label: 'home' },
        { number: '9876543210', label: 'mobile' },
      ])
    ).toBe('9876543210');
  });

  it('recognises the labels the platforms use for a mobile', () => {
    for (const label of ['mobile', 'iPhone', 'Cell', 'main']) {
      expect(
        preferredNumber([
          { number: '9123456780', label: 'work' },
          { number: '9876543210', label },
        ])
      ).toBe('9876543210');
    }
  });

  it('falls back to the first messageable number when none is labelled mobile', () => {
    expect(
      preferredNumber([
        { number: '9123456780', label: 'work' },
        { number: '9876543210', label: 'other' },
      ])
    ).toBe('9123456780');
  });

  it('skips a number VaatUp could not message in favour of one it could', () => {
    expect(
      preferredNumber([
        { number: '100', label: 'work' },
        { number: '9876543210', label: 'other' },
      ])
    ).toBe('9876543210');
  });

  it('still offers an unusable number when it is all the contact has, so it can be corrected', () => {
    expect(preferredNumber([{ number: '100', label: 'work' }])).toBe('100');
  });

  it('keeps the punctuation an address book stores, which the phone rules allow', () => {
    expect(preferredNumber([{ number: '+91 98765 43210', label: 'mobile' }])).toBe(
      '+91 98765 43210'
    );
  });

  it('ignores entries with no number at all', () => {
    expect(preferredNumber([{ label: 'mobile' }, { number: '   ' }])).toBeUndefined();
  });

  it('trims what it hands back', () => {
    expect(preferredNumber([{ number: ' 9876543210 ' }])).toBe('9876543210');
  });
});
