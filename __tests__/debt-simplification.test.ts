import { simplifyDebts } from '@/domain/debt-simplification';
import type { ParticipantBalance } from '@/types/balance';
import { toMinorUnits } from '@/utils/currency';

const rs = (amount: number) => toMinorUnits(amount);

/** Only `net` drives simplification; the rest is filled in for completeness. */
function balance(participantId: string, net: number): ParticipantBalance {
  return {
    participantId,
    paid: net > 0 ? rs(net) : 0,
    owed: net < 0 ? rs(-net) : 0,
    settledOut: 0,
    settledIn: 0,
    net: rs(net),
  };
}

describe('simplifyDebts', () => {
  it('turns one debt into one payment', () => {
    const suggestions = simplifyDebts([balance('aditi', 300), balance('rahul', -300)]);

    expect(suggestions).toEqual([
      { fromParticipantId: 'rahul', toParticipantId: 'aditi', amount: rs(300) },
    ]);
  });

  it('needs no payments when everyone is square', () => {
    expect(simplifyDebts([balance('aditi', 0), balance('rahul', 0)])).toEqual([]);
    expect(simplifyDebts([])).toEqual([]);
  });

  it('clears a circular debt without anyone paying twice', () => {
    // Aditi is owed 200, Rahul owes 500, Neha is owed 300.
    const suggestions = simplifyDebts([
      balance('aditi', 200),
      balance('rahul', -500),
      balance('neha', 300),
    ]);

    expect(suggestions).toEqual([
      { fromParticipantId: 'rahul', toParticipantId: 'neha', amount: rs(300) },
      { fromParticipantId: 'rahul', toParticipantId: 'aditi', amount: rs(200) },
    ]);
  });

  it('never needs more payments than there are people, less one', () => {
    const balances = [
      balance('aditi', 500),
      balance('rahul', -200),
      balance('neha', -150),
      balance('vikram', -100),
      balance('meera', -50),
    ];

    const suggestions = simplifyDebts(balances);
    expect(suggestions.length).toBeLessThanOrEqual(balances.length - 1);
  });

  it('moves exactly as much money as is owed', () => {
    const balances = [
      balance('aditi', 450),
      balance('rahul', -175),
      balance('neha', -125),
      balance('vikram', -150),
    ];

    const moved = simplifyDebts(balances).reduce((sum, suggestion) => sum + suggestion.amount, 0);
    expect(moved).toBe(rs(450));
  });

  it('splits one debtor across several creditors', () => {
    const suggestions = simplifyDebts([
      balance('aditi', 200),
      balance('neha', 100),
      balance('rahul', -300),
    ]);

    expect(suggestions).toEqual([
      { fromParticipantId: 'rahul', toParticipantId: 'aditi', amount: rs(200) },
      { fromParticipantId: 'rahul', toParticipantId: 'neha', amount: rs(100) },
    ]);
  });

  it('gives the same answer whatever order the balances arrive in', () => {
    const balances = [balance('aditi', 250), balance('rahul', -100), balance('neha', -150)];

    const forwards = simplifyDebts(balances);
    const backwards = simplifyDebts([...balances].reverse());
    expect(backwards).toEqual(forwards);
  });
});
