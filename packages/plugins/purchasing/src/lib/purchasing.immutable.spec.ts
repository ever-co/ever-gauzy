import { movedMembers } from './purchasing.immutable';

describe('movedMembers — what a correction to a posted purchasing document would move', () => {
	it('compares an identifier as exact text, even when it reads as a number', () => {
		// Greptile on #10635: the shared helper reads two decimal-looking strings as decimals, so a batch number
		// changed from "10" to "10.0" (or "+1" to "1") was taken for a restatement — the receipt line took the new
		// batch number while its stock movement kept the old one.
		expect(movedMembers({ batchNumber: '10' }, { batchNumber: '10.0' }, ['batchNumber'])).toEqual(['batchNumber']);
		expect(movedMembers({ batchNumber: '1' }, { batchNumber: '+1' }, ['batchNumber'])).toEqual(['batchNumber']);
		// CodeRabbit on #10635: JSON-looking text is not read as JSON either.
		expect(movedMembers({ batchNumber: '[1,2]' }, { batchNumber: '[1, 2]' }, ['batchNumber'])).toEqual(['batchNumber']);
		expect(movedMembers({ batchNumber: 'B1' }, { batchNumber: ['B1'] }, ['batchNumber'])).toEqual(['batchNumber']);
		expect(movedMembers({ batchNumber: '10' }, { batchNumber: '10' }, ['batchNumber'])).toEqual([]);
	});

	it('still compares a date by its instant and leaves an unstated member alone', () => {
		const expiresAt = new Date('2026-12-01T00:00:00.000Z');

		expect(movedMembers({ expiresAt }, { expiresAt: '2026-12-01T00:00:00.000Z' }, ['expiresAt'])).toEqual([]);
		expect(movedMembers({ expiresAt, batchNumber: 'B1' }, { expiresAt: undefined }, ['expiresAt', 'batchNumber'])).toEqual([]);
	});
});
