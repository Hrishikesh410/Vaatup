import * as Linking from 'expo-linking';

import type { Person } from '@/types/person';
import { calculatePercentageSplit, calculateTotal } from '@/utils/calculations';
import { toMinorUnits } from '@/utils/currency';
import { buildShareSummary } from '@/utils/sharing';
import {
  buildPersonalMessage,
  buildWhatsAppLinks,
  openWhatsApp,
  type SplitMessageContext,
} from '@/utils/whatsapp';

jest.mock('expo-linking', () => ({
  canOpenURL: jest.fn(),
  openURL: jest.fn(),
}));

const canOpenURL = Linking.canOpenURL as jest.MockedFunction<typeof Linking.canOpenURL>;
const openURL = Linking.openURL as jest.MockedFunction<typeof Linking.openURL>;

const rs = (amount: number) => toMinorUnits(amount);

const people: Person[] = [
  { id: 'p1', name: 'Hrishikesh', phone: '9876543210' },
  { id: 'p2', name: 'Rahul', phone: '+919876543211' },
  { id: 'p3', name: 'Amit' },
  { id: 'p4', name: 'Neha', phone: '9876543213' },
];

const totals = calculateTotal({
  base: rs(2400),
  tip: { kind: 'amount', amount: rs(60) },
  tax: 0,
});

const context: SplitMessageContext = {
  billName: 'Dinner at ABC Restaurant',
  totals,
  people,
  shares: calculatePercentageSplit(totals.total, people, {
    p1: 40,
    p2: 20,
    p3: 20,
    p4: 20,
  }),
};

describe('buildPersonalMessage', () => {
  it('identifies the bill, the total, the headcount and everyone else', () => {
    const message = buildPersonalMessage(context, people[1]);

    expect(message).toContain('Hey Rahul 👋');
    expect(message).toContain('Dinner at ABC Restaurant');
    expect(message).toContain('Total bill: ₹2,460');
    expect(message).toContain('People: 4');
    expect(message).toContain('Hrishikesh: ₹984');
    expect(message).toContain('Neha: ₹492');
    expect(message).toContain('— VaatUp');
  });

  it('makes the recipient share unmistakable', () => {
    expect(buildPersonalMessage(context, people[1])).toContain('💰 Your share: ₹492');
    expect(buildPersonalMessage(context, people[0])).toContain('💰 Your share: ₹984');
  });

  it('shows the tip breakdown only when there is one', () => {
    expect(buildPersonalMessage(context, people[0])).toContain('(Bill ₹2,400 + Tip ₹60)');

    const plain: SplitMessageContext = {
      ...context,
      totals: calculateTotal({ base: rs(2400), tip: { kind: 'none' }, tax: 0 }),
    };
    expect(buildPersonalMessage(plain, people[0])).not.toContain('Bill ₹2,400 +');
  });

  it('reads naturally when the bill was never named', () => {
    expect(buildPersonalMessage({ ...context, billName: '  ' }, people[0])).toContain(
      "Here's the split for our bill:"
    );
  });

  it('marks who has already paid', () => {
    const message = buildPersonalMessage({ ...context, paid: ['p1'] }, people[1]);

    expect(message).toContain('Hrishikesh: ₹984 (paid)');
    expect(message).toContain('Rahul: ₹492');
    expect(message).not.toContain('Rahul: ₹492 (paid)');
  });

  it('thanks the recipient instead of chasing them once they have paid', () => {
    const message = buildPersonalMessage({ ...context, paid: ['p2'] }, people[1]);

    expect(message).toContain('💰 Your share: ₹492 (received — thanks!)');
    expect(message).toContain('All settled!');
  });

  describe('with a UPI address to collect at', () => {
    const collecting: SplitMessageContext = {
      ...context,
      collector: { vpa: 'asha@okhdfcbank', name: 'Asha' },
    };

    it("asks for the recipient's own share, not the total", () => {
      expect(buildPersonalMessage(collecting, people[1])).toContain(
        '💸 Pay ₹492 to asha@okhdfcbank (any UPI app)'
      );
      expect(buildPersonalMessage(collecting, people[0])).toContain('💸 Pay ₹984 to');
    });

    it('says nothing about paying to someone who already has', () => {
      const message = buildPersonalMessage({ ...collecting, paid: ['p2'] }, people[1]);
      expect(message).not.toContain('any UPI app');
    });

    it('is left out entirely when no address is configured', () => {
      expect(buildPersonalMessage(context, people[1])).not.toContain('UPI');
    });
  });
});

describe('buildWhatsAppLinks', () => {
  it('builds an app link and a universal fallback with the message encoded', () => {
    const links = buildWhatsAppLinks('919876543210', 'Your share: ₹600');

    expect(links.appUrl).toBe(
      'whatsapp://send?phone=919876543210&text=Your%20share%3A%20%E2%82%B9600'
    );
    expect(links.webUrl).toBe('https://wa.me/919876543210?text=Your%20share%3A%20%E2%82%B9600');
  });
});

describe('openWhatsApp', () => {
  beforeEach(() => {
    canOpenURL.mockReset();
    openURL.mockReset();
    openURL.mockResolvedValue(true);
  });

  it('opens the installed app when it can', async () => {
    canOpenURL.mockResolvedValue(true);

    await expect(openWhatsApp({ phone: '9876543210', message: 'hi' })).resolves.toEqual({
      ok: true,
    });
    expect(openURL).toHaveBeenCalledWith(expect.stringContaining('whatsapp://send'));
  });

  it('falls back to the wa.me link when the app scheme is unavailable', async () => {
    canOpenURL.mockResolvedValue(false);

    await expect(openWhatsApp({ phone: '9876543210', message: 'hi' })).resolves.toEqual({
      ok: true,
    });
    expect(openURL).toHaveBeenCalledWith(expect.stringContaining('https://wa.me/'));
  });

  it('reports when nothing can handle the link', async () => {
    canOpenURL.mockResolvedValue(false);
    openURL.mockRejectedValue(new Error('no handler'));

    await expect(openWhatsApp({ phone: '9876543210', message: 'hi' })).resolves.toEqual({
      ok: false,
      reason: 'not-installed',
    });
  });

  it('never opens anything without a usable number', async () => {
    await expect(openWhatsApp({ phone: undefined, message: 'hi' })).resolves.toEqual({
      ok: false,
      reason: 'no-phone',
    });
    await expect(openWhatsApp({ phone: '12345', message: 'hi' })).resolves.toEqual({
      ok: false,
      reason: 'invalid-phone',
    });
    expect(openURL).not.toHaveBeenCalled();
  });
});

describe('buildShareSummary', () => {
  it('lists the bill, total and everyone in plain text', () => {
    expect(buildShareSummary(context)).toBe(
      [
        'Dinner at ABC Restaurant',
        '',
        'Total: ₹2,460',
        '(Bill ₹2,400 + Tip ₹60)',
        '',
        'Hrishikesh: ₹984',
        'Rahul: ₹492',
        'Amit: ₹492',
        'Neha: ₹492',
      ].join('\n')
    );
  });

  it('flags paid shares and what is left to collect', () => {
    const summary = buildShareSummary({ ...context, paid: ['p1', 'p3'] });

    expect(summary).toContain('Hrishikesh: ₹984 (paid)');
    expect(summary).toContain('Amit: ₹492 (paid)');
    expect(summary).toContain('Rahul: ₹492\n');
    expect(summary).toContain('Still to collect: ₹984 from 2 of 4.');
  });

  it('says so plainly once everyone has paid', () => {
    const summary = buildShareSummary({
      ...context,
      paid: ['p1', 'p2', 'p3', 'p4'],
    });

    expect(summary).toContain('Everyone has paid.');
    expect(summary).not.toContain('Still to collect');
  });

  it('names one address for the group, without a single amount', () => {
    const summary = buildShareSummary({
      ...context,
      collector: { vpa: 'asha@okhdfcbank', name: 'Asha' },
    });

    expect(summary).toContain('Pay your share to asha@okhdfcbank (any UPI app)');
  });
});
