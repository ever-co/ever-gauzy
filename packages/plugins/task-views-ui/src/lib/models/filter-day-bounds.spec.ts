// cspell:ignore Kiritimati
import { runInThisContext } from 'node:vm';
import { ITaskViewFilterCondition } from '@gauzy/contracts';
import { boundOfDay, dayOfBound } from './date-input';
import { withBound, withOperator, withPickedDay } from './filter-tree';

/** UTC−4 all year (no daylight saving), and UTC+2 all year. */
const WEST = 'America/Caracas';
const EAST = 'Africa/Johannesburg';

/**
 * Runs `body` with the clock in `zone`, as a browser there would be. Jest hands each test file a copy of
 * `process.env`, so setting `TZ` on it changes nothing: Node reads the host process's `env.TZ`.
 */
function inZone<T>(zone: string, body: () => T): T {
	const host = runInThisContext('process') as NodeJS.Process;
	const previous = host.env['TZ'];
	const current = Intl.DateTimeFormat().resolvedOptions().timeZone;
	host.env['TZ'] = zone;
	try {
		return body();
	} finally {
		// Deleting `TZ` does not reset the clock's zone: set the one before first.
		host.env['TZ'] = previous ?? current;
		if (previous === undefined) delete host.env['TZ'];
	}
}

describe('the bounds a picked day makes', () => {
	it('switches the clock’s zone for real (the cases below would hold in one zone)', () => {
		expect(inZone(WEST, () => new Date(2026, 10, 14).getTimezoneOffset())).toBe(240);
		expect(inZone(EAST, () => new Date(2026, 10, 14).getTimezoneOffset())).toBe(-120);
	});

	it('carries the day picked with the instant of it in the reader’s zone, west and east of UTC', () => {
		expect(inZone(WEST, () => boundOfDay('2026-11-14', 'from'))).toEqual({
			instant: '2026-11-14T04:00:00.000Z',
			day: '2026-11-14'
		});
		expect(inZone(WEST, () => boundOfDay('2026-11-20', 'until'))).toEqual({
			instant: '2026-11-21T03:59:59.999Z',
			day: '2026-11-20'
		});
		expect(inZone(EAST, () => boundOfDay('2026-11-14', 'before'))).toEqual({
			instant: '2026-11-13T22:00:00.000Z',
			day: '2026-11-14'
		});
		expect(inZone(EAST, () => boundOfDay('2026-11-20', 'until'))).toEqual({
			instant: '2026-11-20T21:59:59.999Z',
			day: '2026-11-20'
		});
		expect(boundOfDay('', 'from')).toBeNull();
		expect(boundOfDay('14/11/2026', 'from')).toBeNull();
		// The day sent is the day of the instant built: a date field never sends 30 Feb, and nothing else may either.
		expect(inZone(WEST, () => boundOfDay('2026-02-30', 'from')?.day)).toBe('2026-03-02');
	});

	it('shows the day picked to a reader in another zone, and the reader’s day of the instant for older views', () => {
		// 14 Nov picked in UTC+2 is 22:00 on the 13th in UTC: the 13th for a reader in UTC−4, by the instant alone.
		const picked: ITaskViewFilterCondition = {
			field: 'dueDate',
			operator: 'after',
			from: '2026-11-13T22:00:00.000Z',
			fromDay: '2026-11-14'
		};
		expect(inZone(WEST, () => dayOfBound(picked, 'from', 'from'))).toBe('2026-11-14');
		const older: ITaskViewFilterCondition = { field: 'dueDate', operator: 'after', from: picked.from };
		expect(inZone(WEST, () => dayOfBound(older, 'from', 'from'))).toBe('2026-11-13');
		expect(inZone(EAST, () => dayOfBound(older, 'from', 'from'))).toBe('2026-11-14');
	});

	it('sets and clears a bound with its day', () => {
		const condition: ITaskViewFilterCondition = { field: 'dueDate', operator: 'between' };
		const set = withBound(condition, 'from', '2026-11-14T04:00:00.000Z', '2026-11-14');
		expect(set).toEqual({
			field: 'dueDate',
			operator: 'between',
			from: '2026-11-14T04:00:00.000Z',
			fromDay: '2026-11-14'
		});
		expect(withBound(set, 'from', null)).toEqual(condition);
		// An instant without its day drops the day the bound had.
		expect(withBound(set, 'from', '2026-11-20T04:00:00.000Z')).toEqual({
			field: 'dueDate',
			operator: 'between',
			from: '2026-11-20T04:00:00.000Z'
		});
		expect(withBound(set, 'to', '2026-11-21T03:59:59.999Z', '2026-11-20')).toEqual({
			...set,
			to: '2026-11-21T03:59:59.999Z',
			toDay: '2026-11-20'
		});
	});

	it('moves an upper bound picked as a day to the instant the new operator reads of it, keeping the day', () => {
		inZone(WEST, () => {
			const between: ITaskViewFilterCondition = {
				field: 'dueDate',
				operator: 'between',
				from: '2026-11-14T04:00:00.000Z',
				fromDay: '2026-11-14',
				to: '2026-11-21T03:59:59.999Z',
				toDay: '2026-11-20'
			};
			// "Before 20 Nov" stops at the start of the 20th; "between … and 20 Nov" runs to the end of it.
			const before = withOperator(between, 'before');
			expect(before).toEqual({
				field: 'dueDate',
				operator: 'before',
				to: '2026-11-20T04:00:00.000Z',
				toDay: '2026-11-20'
			});
			expect(withOperator(before, 'between')).toEqual({
				field: 'dueDate',
				operator: 'between',
				to: '2026-11-21T03:59:59.999Z',
				toDay: '2026-11-20'
			});
			expect(withOperator(between, 'after')).toEqual({
				field: 'dueDate',
				operator: 'after',
				from: '2026-11-14T04:00:00.000Z',
				fromDay: '2026-11-14'
			});
		});
	});

	it('keeps both bounds in the picker’s zone when one is picked again, so a range never ends before it starts', () => {
		// "Between 14 and 14 Nov" saved in UTC−10, then the end picked again (14 Nov) by a reader in UTC+14.
		const saved = inZone('Pacific/Honolulu', () =>
			withPickedDay(
				withPickedDay({ field: 'dueDate', operator: 'between' }, 'from', '2026-11-14', 'from'),
				'to',
				'2026-11-14',
				'until'
			)
		);
		expect(saved).toEqual({
			field: 'dueDate',
			operator: 'between',
			from: '2026-11-14T10:00:00.000Z',
			fromDay: '2026-11-14',
			to: '2026-11-15T09:59:59.999Z',
			toDay: '2026-11-14'
		});
		const edited = inZone('Pacific/Kiritimati', () => withPickedDay(saved, 'to', '2026-11-14', 'until'));
		// The end is the 14th's last instant in UTC+14, and the start, picked as the 14th, moves to its start there.
		expect(edited).toEqual({
			field: 'dueDate',
			operator: 'between',
			from: '2026-11-13T10:00:00.000Z',
			fromDay: '2026-11-14',
			to: '2026-11-14T09:59:59.999Z',
			toDay: '2026-11-14'
		});
		expect(Date.parse(edited.from as string)).toBeLessThan(Date.parse(edited.to as string));
		// "Before" reads the start of its day; a bound saved without its day keeps its instant; a cleared field clears.
		expect(
			inZone(WEST, () => withPickedDay({ field: 'dueDate', operator: 'before' }, 'to', '2026-11-14', 'before'))
		).toEqual({
			field: 'dueDate',
			operator: 'before',
			to: '2026-11-14T04:00:00.000Z',
			toDay: '2026-11-14'
		});
		const older: ITaskViewFilterCondition = {
			field: 'dueDate',
			operator: 'between',
			from: '2026-11-13T22:00:00.000Z'
		};
		expect(inZone(WEST, () => withPickedDay(older, 'to', '2026-11-20', 'until'))).toEqual({
			...older,
			to: '2026-11-21T03:59:59.999Z',
			toDay: '2026-11-20'
		});
		expect(withPickedDay(saved, 'to', '', 'until')).toEqual({
			field: 'dueDate',
			operator: 'between',
			from: saved.from,
			fromDay: '2026-11-14'
		});
	});
});
