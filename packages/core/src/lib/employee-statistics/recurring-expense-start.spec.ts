import { recurringExpenseStart } from './recurring-expense-start';

describe('recurringExpenseStart', () => {
	it('starts at the expense start date when it falls inside the range (range start given as a string)', () => {
		expect(recurringExpenseStart(new Date('2026-06-01T00:00:00.000Z'), '2026-01-01T00:00:00.000Z')).toEqual(
			new Date('2026-06-01T00:00:00.000Z')
		);
	});

	it('starts at the range start when the expense started before it', () => {
		expect(recurringExpenseStart(new Date('2025-03-01T00:00:00.000Z'), '2026-01-01T00:00:00.000Z')).toEqual(
			new Date('2026-01-01T00:00:00.000Z')
		);
	});

	it('accepts both values as Dates', () => {
		expect(
			recurringExpenseStart(new Date('2026-06-01T00:00:00.000Z'), new Date('2026-01-01T00:00:00.000Z'))
		).toEqual(new Date('2026-06-01T00:00:00.000Z'));
	});
});
