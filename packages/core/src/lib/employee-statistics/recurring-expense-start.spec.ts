import { recurringExpenseMonths, recurringExpenseStart } from './recurring-expense-start';

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

describe('recurringExpenseMonths', () => {
	it('gives one date per month of the range', () => {
		expect(recurringExpenseMonths(new Date(2026, 0, 15), new Date(2026, 2, 31))).toEqual([
			new Date(2026, 0, 15),
			new Date(2026, 1, 15),
			new Date(2026, 2, 15)
		]);
	});

	it('does not skip a shorter month when the expense starts on the 31st', () => {
		expect(recurringExpenseMonths(new Date(2026, 0, 31), new Date(2026, 3, 30))).toEqual([
			new Date(2026, 0, 31),
			new Date(2026, 1, 28),
			new Date(2026, 2, 31),
			new Date(2026, 3, 30)
		]);
	});

	it('is empty when the start is after the end', () => {
		expect(recurringExpenseMonths(new Date(2026, 5, 1), new Date(2026, 4, 31))).toEqual([]);
	});
});
