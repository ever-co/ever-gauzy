import { formatDate } from '@angular/common';
import { runInThisContext } from 'node:vm';
import { dateOnlyOf, dayOfDateOnly, dueDateShown, dueDeadline } from './date-only';

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

/** UTC−4 all year (no daylight saving), and UTC+2 all year. */
const WEST = 'America/Caracas';
const EAST = 'Africa/Johannesburg';

describe('date-only due dates', () => {
	it('switches the clock’s zone for real (the cases below would hold in one zone)', () => {
		expect(inZone(WEST, () => new Date(2026, 10, 14).getTimezoneOffset())).toBe(240);
		expect(inZone(EAST, () => new Date(2026, 10, 14).getTimezoneOffset())).toBe(-120);
	});

	it('writes a calendar day as midnight UTC of it', () => {
		expect(dateOnlyOf(2026, 10, 14).toISOString()).toBe('2026-11-14T00:00:00.000Z');
	});

	it('reads a bare day and midnight UTC as a day, and any other moment as a moment', () => {
		expect(dayOfDateOnly('2026-11-14')).toEqual([2026, 10, 14]);
		expect(dayOfDateOnly('2026-11-14T00:00:00.000Z')).toEqual([2026, 10, 14]);
		expect(dayOfDateOnly(new Date('2026-11-14T00:00:00+00:00'))).toEqual([2026, 10, 14]);
		expect(dayOfDateOnly('2026-11-15T03:59:59.000Z')).toBeNull();
		expect(dayOfDateOnly('not a date')).toBeNull();
		expect(dayOfDateOnly(null)).toBeNull();
		expect(dayOfDateOnly('')).toBeNull();
	});

	it('shows a date-only value as its own day in any zone, through either way the pages format a date', () => {
		for (const zone of [WEST, 'America/Los_Angeles', 'UTC', EAST, 'Pacific/Auckland']) {
			inZone(zone, () => {
				const shown = dueDateShown('2026-11-14T00:00:00.000Z');
				// Angular's `date` pipe, and the platform's `dateFormat` pipe (`moment(new Date(value))`).
				expect(`${zone} ${formatDate(shown as Date, 'mediumDate', 'en-US')}`).toBe(`${zone} Nov 14, 2026`);
				expect(`${zone} ${new Date(shown as Date).getDate()}`).toBe(`${zone} 14`);
			});
		}
	});

	it('shows a moment in the reader’s zone, as before', () => {
		// The end of 14 Nov in UTC−4: a reader in UTC+2 reads it as the 15th, which is what it is as a moment.
		const moment = '2026-11-15T03:59:59.000Z';
		expect(dueDateShown(moment)).toBe(moment);
		inZone(EAST, () =>
			expect(formatDate(dueDateShown(moment) as string, 'mediumDate', 'en-US')).toBe('Nov 15, 2026')
		);
		expect(dueDateShown(null)).toBeNull();
		expect(dueDateShown('')).toBeNull();
	});

	it('is due until the end of its day in the reader’s zone; a moment until that moment', () => {
		inZone(WEST, () => {
			expect(dueDeadline('2026-11-14T00:00:00.000Z')).toBe(new Date(2026, 10, 14, 23, 59, 59, 999).getTime());
		});
		inZone(EAST, () => {
			expect(dueDeadline(new Date('2026-11-14T00:00:00.000Z'))).toBe(
				new Date(2026, 10, 14, 23, 59, 59, 999).getTime()
			);
		});
		expect(dueDeadline('2026-11-15T03:59:59.000Z')).toBe(Date.parse('2026-11-15T03:59:59.000Z'));
		expect(dueDeadline(undefined)).toBeNull();
		expect(dueDeadline('not a date')).toBeNull();
	});
});
