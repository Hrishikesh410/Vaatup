import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from 'react';

import { createExpense, resolveSplits, updateExpense } from '@/application/expense-service';
import { resolveParticipants } from '@/application/people-service';
import { markShareSettled, unmarkShareSettled } from '@/application/settlement-service';
import { useSession } from '@/state/session';
import { DEFAULT_CATEGORY_ID, type CategoryId } from '@/types/category';
import type { BillDraft, BillTotals, DraftItem, Tip } from '@/types/bill';
import type {
  Expense,
  ExpenseDetail,
  ExpenseId,
  ExpenseInput,
  ExpensePayer,
} from '@/types/expense';
import type { GroupId } from '@/types/group';
import type { Money } from '@/types/money';
import type { Person, PersonId } from '@/types/person';
import type { SplitType } from '@/types/split';
import { calculateTotal, roundSplitAmounts } from '@/utils/calculations';
import { DEFAULT_CURRENCY } from '@/utils/currency';
import { nowIso } from '@/utils/date';
import { createId } from '@/utils/id';
import { keepPaidFor, togglePaidId } from '@/utils/paid';

/**
 * The expense being built lives in one place for the whole create → people →
 * split → result flow. Screens read and mutate it through this context instead
 * of passing state through navigation params, which keeps deep links and the
 * back button simple.
 *
 * The draft is memory-only. `commit` is the single point where it becomes a
 * stored expense, and it goes through the expense use case like any other
 * write, so the same validation applies to a three-tap split and an edit.
 */

function emptyDraft(): BillDraft {
  return {
    id: createId('bill'),
    name: '',
    base: 0,
    tip: { kind: 'none' },
    tax: 0,
    people: [],
    splitType: 'equal',
    exactAmounts: {},
    percentages: {},
    shareCounts: {},
    payerIds: [],
    payments: {},
    categoryId: DEFAULT_CATEGORY_ID,
    notes: '',
    items: [],
    paid: [],
    spentAt: nowIso(),
    createdAt: nowIso(),
  };
}

/** Equal percentages that still add up to exactly 100 (33.34 / 33.33 / 33.33). */
function equalPercentages(people: Person[]): Record<PersonId, number> {
  const basisPoints = roundSplitAmounts(
    10_000,
    people.map(() => 1)
  );
  return Object.fromEntries(
    people.map((person, index) => [person.id, (basisPoints[index] ?? 0) / 100])
  );
}

function equalAmounts(total: Money, people: Person[]): Record<PersonId, Money> {
  const amounts = roundSplitAmounts(
    total,
    people.map(() => 1)
  );
  return Object.fromEntries(people.map((person, index) => [person.id, amounts[index] ?? 0]));
}

function oneShareEach(people: Person[]): Record<PersonId, number> {
  return Object.fromEntries(people.map((person) => [person.id, 1]));
}

/** True when a split-input map has exactly one entry per person, no more, no less. */
function coversExactlyThesePeople(
  entriesByPersonId: Record<string, unknown>,
  people: Person[]
): boolean {
  const personIds = Object.keys(entriesByPersonId);
  return (
    personIds.length === people.length && people.every((person) => person.id in entriesByPersonId)
  );
}

/**
 * Who paid, as the expense model needs it.
 *
 * With one payer there is nothing to enter — they covered the total — so the
 * amount is derived. With several, the entered amounts are used as-is and are
 * validated before the expense is allowed to save.
 */
export function resolvePayers(draft: BillDraft, total: Money): ExpensePayer[] {
  const payerIds = draft.payerIds.filter((id) => draft.people.some((person) => person.id === id));

  if (payerIds.length === 0) {
    const fallback = draft.people[0];
    return fallback ? [{ participantId: fallback.id, amountPaid: total }] : [];
  }
  if (payerIds.length === 1) {
    return [{ participantId: payerIds[0], amountPaid: total }];
  }
  return payerIds.map((id) => ({
    participantId: id,
    amountPaid: Math.max(0, Math.round(draft.payments[id] ?? 0)),
  }));
}

type Action =
  | { type: 'reset' }
  | { type: 'hydrate'; expense: ExpenseDetail }
  | { type: 'setName'; name: string }
  | { type: 'setBase'; base: Money }
  | { type: 'setTip'; tip: Tip }
  | { type: 'setTax'; tax: Money }
  | { type: 'addPerson'; person: Person }
  | { type: 'updatePerson'; person: Person }
  | { type: 'removePerson'; id: PersonId }
  | { type: 'setSplitType'; splitType: SplitType }
  | { type: 'setExactAmount'; id: PersonId; amount: Money }
  | { type: 'setPercentage'; id: PersonId; percent: number }
  | { type: 'setShareCount'; id: PersonId; shares: number }
  | { type: 'setPayerIds'; ids: PersonId[] }
  | { type: 'setPayment'; id: PersonId; amount: Money }
  | { type: 'setGroup'; groupId?: GroupId }
  | { type: 'setCategory'; categoryId: CategoryId }
  | { type: 'setNotes'; notes: string }
  | { type: 'setReceipt'; receiptUri?: string }
  | { type: 'setItems'; items: DraftItem[] }
  | { type: 'setSpentAt'; spentAt: string }
  | { type: 'setPaid'; paid: PersonId[] }
  | { type: 'saved'; expenseId: ExpenseId; idMap: Map<PersonId, PersonId> }
  | { type: 'resetToEqual' }
  | { type: 'ensureDefaults' };

/**
 * Fills in the split inputs for the active split type.
 *
 * Values the user has already typed are left alone unless they no longer line up
 * with the current people, or `overwriteExisting` is set — which is what happens
 * when the split type changes and the old numbers no longer mean anything.
 */
function withSplitDefaults(draft: BillDraft, overwriteExisting = false): BillDraft {
  const { total } = calculateTotal(draft);
  let updated = draft;

  if (updated.splitType === 'exact') {
    const forDifferentPeople = !coversExactlyThesePeople(updated.exactAmounts, updated.people);
    const untouched = Object.values(updated.exactAmounts).every((amount) => amount === 0);
    if (overwriteExisting || forDifferentPeople || untouched) {
      updated = {
        ...updated,
        exactAmounts: equalAmounts(total, updated.people),
      };
    }
  }

  if (updated.splitType === 'percentage') {
    const forDifferentPeople = !coversExactlyThesePeople(updated.percentages, updated.people);
    const untouched = Object.values(updated.percentages).every((percent) => percent === 0);
    if (overwriteExisting || forDifferentPeople || untouched) {
      updated = { ...updated, percentages: equalPercentages(updated.people) };
    }
  }

  if (updated.splitType === 'shares') {
    const forDifferentPeople = !coversExactlyThesePeople(updated.shareCounts, updated.people);
    const untouched = Object.values(updated.shareCounts).every((shares) => shares === 0);
    if (overwriteExisting || forDifferentPeople || untouched) {
      updated = { ...updated, shareCounts: oneShareEach(updated.people) };
    }
  }

  // A bill always has a payer; default to the first person, which is the user.
  if (updated.payerIds.length === 0 && updated.people.length > 0) {
    updated = { ...updated, payerIds: [updated.people[0].id] };
  }

  return updated;
}

function reducer(draft: BillDraft, action: Action): BillDraft {
  switch (action.type) {
    case 'reset':
      return emptyDraft();

    case 'hydrate': {
      const { expense } = action;
      const people: Person[] = expense.splits.map((split) => {
        const participant = expense.participants.find((person) => person.id === split.personId);
        return {
          id: split.personId,
          name: participant?.name ?? 'Removed person',
          phone: participant?.phone,
        };
      });

      const inputValues = Object.fromEntries(
        expense.splits.map((split) => [split.personId, split.inputValue])
      );
      const amounts = Object.fromEntries(
        expense.splits.map((split) => [split.personId, split.amount])
      );

      return {
        id: expense.id,
        expenseId: expense.id,
        name: expense.description,
        base: expense.baseAmount,
        // A stored tip is settled money; the percentage that produced it is not
        // kept, so editing shows it as an amount.
        tip:
          expense.tipAmount > 0 ? { kind: 'amount', amount: expense.tipAmount } : { kind: 'none' },
        tax: expense.taxAmount,
        people,
        splitType: expense.splitType,
        exactAmounts: expense.splitType === 'exact' ? inputValues : amounts,
        percentages: expense.splitType === 'percentage' ? inputValues : {},
        shareCounts: expense.splitType === 'shares' ? inputValues : {},
        payerIds: expense.payers.map((payer) => payer.participantId),
        payments: Object.fromEntries(
          expense.payers.map((payer) => [payer.participantId, payer.amountPaid])
        ),
        groupId: expense.groupId,
        categoryId: expense.categoryId,
        notes: expense.notes ?? '',
        receiptUri: expense.receiptUri,
        items: expense.items.map((item) => ({
          name: item.name,
          amount: item.amount,
          assignedTo: item.assignedTo,
        })),
        paid: [],
        spentAt: expense.spentAt,
        createdAt: expense.createdAt,
      };
    }

    case 'setName':
      return { ...draft, name: action.name };

    case 'setBase':
      return { ...draft, base: action.base };

    case 'setTip':
      return { ...draft, tip: action.tip };

    case 'setTax':
      return { ...draft, tax: action.tax };

    case 'addPerson':
      return withSplitDefaults({
        ...draft,
        people: [...draft.people, action.person],
      });

    case 'updatePerson':
      return {
        ...draft,
        people: draft.people.map((person) =>
          person.id === action.person.id ? action.person : person
        ),
      };

    case 'removePerson': {
      const { [action.id]: _amount, ...exactAmounts } = draft.exactAmounts;
      const { [action.id]: _percent, ...percentages } = draft.percentages;
      const { [action.id]: _shares, ...shareCounts } = draft.shareCounts;
      const { [action.id]: _payment, ...payments } = draft.payments;
      const people = draft.people.filter((person) => person.id !== action.id);
      return withSplitDefaults({
        ...draft,
        people,
        exactAmounts,
        percentages,
        shareCounts,
        payments,
        payerIds: draft.payerIds.filter((id) => id !== action.id),
        paid: keepPaidFor(draft.paid, people),
      });
    }

    case 'setSplitType':
      return withSplitDefaults({ ...draft, splitType: action.splitType }, true);

    case 'setExactAmount':
      return {
        ...draft,
        exactAmounts: { ...draft.exactAmounts, [action.id]: action.amount },
      };

    case 'setPercentage':
      return {
        ...draft,
        percentages: { ...draft.percentages, [action.id]: action.percent },
      };

    case 'setShareCount':
      return {
        ...draft,
        shareCounts: { ...draft.shareCounts, [action.id]: action.shares },
      };

    case 'setPayerIds': {
      // Switching to several payers seeds an even split of the total so the
      // user adjusts numbers rather than starting from zero.
      const total = calculateTotal(draft).total;
      const payments =
        action.ids.length > 1
          ? Object.fromEntries(
              roundSplitAmounts(
                total,
                action.ids.map(() => 1)
              ).map((amount, index) => [action.ids[index], amount])
            )
          : {};
      return { ...draft, payerIds: action.ids, payments };
    }

    case 'setPayment':
      return {
        ...draft,
        payments: { ...draft.payments, [action.id]: action.amount },
      };

    case 'setGroup':
      return { ...draft, groupId: action.groupId };

    case 'setCategory':
      return { ...draft, categoryId: action.categoryId };

    case 'setNotes':
      return { ...draft, notes: action.notes };

    case 'setReceipt':
      return { ...draft, receiptUri: action.receiptUri };

    case 'setItems':
      return { ...draft, items: action.items };

    case 'setSpentAt':
      return { ...draft, spentAt: action.spentAt };

    case 'setPaid':
      return { ...draft, paid: action.paid };

    /**
     * After a commit the draft's temporary person ids are replaced with the
     * saved participant ids. Without this, marking someone paid on the result
     * screen would write a settlement for a participant that does not exist.
     */
    case 'saved': {
      const idFor = (id: PersonId) => action.idMap.get(id) ?? id;
      const remap = <T,>(map: Record<PersonId, T>): Record<PersonId, T> =>
        Object.fromEntries(Object.entries(map).map(([id, value]) => [idFor(id), value]));

      return {
        ...draft,
        expenseId: action.expenseId,
        people: draft.people.map((person) => ({
          ...person,
          id: idFor(person.id),
        })),
        exactAmounts: remap(draft.exactAmounts),
        percentages: remap(draft.percentages),
        shareCounts: remap(draft.shareCounts),
        payments: remap(draft.payments),
        payerIds: draft.payerIds.map(idFor),
        paid: draft.paid.map(idFor),
        items: draft.items.map((item) => ({
          ...item,
          assignedTo: item.assignedTo.map(idFor),
        })),
      };
    }

    case 'resetToEqual':
      return withSplitDefaults(draft, true);

    case 'ensureDefaults':
      return withSplitDefaults(draft);
  }
}

interface BillDraftValue {
  draft: BillDraft;
  totals: BillTotals;
  /** Who paid, resolved against the current total. */
  payers: ExpensePayer[];
  startNewBill: () => void;
  hydrate: (expense: ExpenseDetail) => void;
  setName: (name: string) => void;
  setBase: (base: Money) => void;
  setTip: (tip: Tip) => void;
  setTax: (tax: Money) => void;
  addPerson: (name: string, phone?: string, id?: PersonId) => void;
  updatePerson: (person: Person) => void;
  removePerson: (id: PersonId) => void;
  setSplitType: (splitType: SplitType) => void;
  setExactAmount: (id: PersonId, amount: Money) => void;
  setPercentage: (id: PersonId, percent: number) => void;
  setShareCount: (id: PersonId, shares: number) => void;
  setPayerIds: (ids: PersonId[]) => void;
  setPayment: (id: PersonId, amount: Money) => void;
  setGroup: (groupId?: GroupId) => void;
  setCategory: (categoryId: CategoryId) => void;
  setNotes: (notes: string) => void;
  setReceipt: (receiptUri?: string) => void;
  setItems: (items: DraftItem[]) => void;
  setSpentAt: (spentAt: string) => void;
  /** Flips one person between paid and unpaid on a saved expense. */
  togglePaid: (id: PersonId) => void;
  setAllPaid: (paid: boolean) => void;
  resetToEqual: () => void;
  ensureDefaults: () => void;
  /** Persists the draft as an expense and returns it. */
  commit: () => Promise<Expense>;
}

const BillDraftContext = createContext<BillDraftValue | null>(null);

export function BillDraftProvider({ children }: { children: ReactNode }) {
  const [draft, dispatch] = useReducer(reducer, undefined, emptyDraft);
  // The flow only runs behind the auth gate, so there is always a user by the
  // time anything is committed or settled.
  const ownerUserId = useSession().user?.id ?? '';
  const totals = useMemo(() => calculateTotal(draft), [draft]);
  const payers = useMemo(() => resolvePayers(draft, totals.total), [draft, totals.total]);

  /**
   * Marking someone paid happens on the result screen, after the expense is
   * saved, so it writes a settlement straight away rather than waiting for a
   * commit. The expense itself is never touched: it records what was spent, the
   * settlement records what has since been paid.
   */
  const applyPaid = useCallback(
    (next: PersonId[]) => {
      const previous = draft.paid;
      const expenseId = draft.expenseId;
      dispatch({ type: 'setPaid', paid: next });
      if (!expenseId || ownerUserId === '') return;

      const added = next.filter((id) => !previous.includes(id));
      const removed = previous.filter((id) => !next.includes(id));

      void (async () => {
        for (const id of added) await markShareSettled(ownerUserId, expenseId, id);
        for (const id of removed) await unmarkShareSettled(expenseId, id);
      })();
    },
    [draft.paid, draft.expenseId, ownerUserId]
  );

  const commit = useCallback(async () => {
    const finalTotals = calculateTotal(draft);
    const idMap = await resolveParticipants(ownerUserId, draft.people);
    const idFor = (personId: PersonId): PersonId => idMap.get(personId) ?? personId;

    const shares = resolveSplits({
      splitType: draft.splitType,
      total: finalTotals.total,
      people: draft.people,
      exactAmounts: draft.exactAmounts,
      percentages: draft.percentages,
      shareCounts: draft.shareCounts,
    });

    const input: ExpenseInput = {
      groupId: draft.groupId,
      description: draft.name.trim() === '' ? 'Bill' : draft.name.trim(),
      baseAmount: finalTotals.base,
      tipAmount: finalTotals.tip,
      taxAmount: finalTotals.tax,
      currencyCode: DEFAULT_CURRENCY.code,
      splitType: draft.splitType,
      categoryId: draft.categoryId,
      notes: draft.notes.trim() === '' ? undefined : draft.notes.trim(),
      receiptUri: draft.receiptUri,
      spentAt: draft.spentAt,
      payers: resolvePayers(draft, finalTotals.total).map((payer) => ({
        participantId: idFor(payer.participantId),
        amountPaid: payer.amountPaid,
      })),
      splits: shares.map((share) => ({
        ...share,
        personId: idFor(share.personId),
      })),
      items: draft.items.map((item, index) => ({
        name: item.name,
        amount: item.amount,
        position: index,
        assignedTo: item.assignedTo.map(idFor),
      })),
    };

    const expense = draft.expenseId
      ? await updateExpense(draft.expenseId, input)
      : await createExpense(ownerUserId, input);

    dispatch({ type: 'saved', expenseId: expense.id, idMap });
    return expense;
  }, [draft, ownerUserId]);

  const value = useMemo<BillDraftValue>(
    () => ({
      draft,
      totals,
      payers,
      startNewBill: () => dispatch({ type: 'reset' }),
      hydrate: (expense) => dispatch({ type: 'hydrate', expense }),
      setName: (name) => dispatch({ type: 'setName', name }),
      setBase: (base) => dispatch({ type: 'setBase', base }),
      setTip: (tip) => dispatch({ type: 'setTip', tip }),
      setTax: (tax) => dispatch({ type: 'setTax', tax }),
      addPerson: (name, phone, id) =>
        dispatch({
          type: 'addPerson',
          person: {
            id: id ?? createId('person'),
            name: name.trim(),
            phone: phone?.trim() || undefined,
          },
        }),
      updatePerson: (person) => dispatch({ type: 'updatePerson', person }),
      removePerson: (id) => dispatch({ type: 'removePerson', id }),
      setSplitType: (splitType) => dispatch({ type: 'setSplitType', splitType }),
      setExactAmount: (id, amount) => dispatch({ type: 'setExactAmount', id, amount }),
      setPercentage: (id, percent) => dispatch({ type: 'setPercentage', id, percent }),
      setShareCount: (id, shares) => dispatch({ type: 'setShareCount', id, shares }),
      setPayerIds: (ids) => dispatch({ type: 'setPayerIds', ids }),
      setPayment: (id, amount) => dispatch({ type: 'setPayment', id, amount }),
      setGroup: (groupId) => dispatch({ type: 'setGroup', groupId }),
      setCategory: (categoryId) => dispatch({ type: 'setCategory', categoryId }),
      setNotes: (notes) => dispatch({ type: 'setNotes', notes }),
      setReceipt: (receiptUri) => dispatch({ type: 'setReceipt', receiptUri }),
      setItems: (items) => dispatch({ type: 'setItems', items }),
      setSpentAt: (spentAt) => dispatch({ type: 'setSpentAt', spentAt }),
      togglePaid: (id) => {
        if (!draft.people.some((person) => person.id === id)) return;
        applyPaid(togglePaidId(draft.paid, id));
      },
      setAllPaid: (paid) => applyPaid(paid ? draft.people.map((person) => person.id) : []),
      resetToEqual: () => dispatch({ type: 'resetToEqual' }),
      ensureDefaults: () => dispatch({ type: 'ensureDefaults' }),
      commit,
    }),
    [draft, totals, payers, applyPaid, commit]
  );

  return <BillDraftContext.Provider value={value}>{children}</BillDraftContext.Provider>;
}

export function useBillDraft(): BillDraftValue {
  const value = useContext(BillDraftContext);
  if (!value) throw new Error('useBillDraft must be used inside <BillDraftProvider>');
  return value;
}
