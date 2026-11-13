import { formatDate } from '@angular/common';
import { runInThisContext } from 'node:vm';
import { ITaskBulkUpdateInput, TaskStatusEnum } from '@gauzy/contracts';
import { dueDateShown } from '@gauzy/ui-core/common';
import { isOverdue } from '../components/task-list/task-list.component';
import { bulkRequest, dueDateChanges } from './bulk-undo';
import { dayNumberOf, dayOfStoredDate } from './timeline';

/** UTC−4 all year (no daylight saving), and UTC+2 all year. */
const PICKER_ZONE = 'America/Caracas';
const READER_ZONE = 'Africa/Johannesburg';

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

/** What the bulk toolbar sends for a day picked in its date field, as it goes over the wire (JSON). */
function pickedAndSent(day: string): string {
	const [year, month, date] = day.split('-').map(Number);
	const built = bulkRequest(['task-1'] as never, dueDateChanges(new Date(year, month - 1, date)), {});
	const request = (built as { request: ITaskBulkUpdateInput }).request;
	return (JSON.parse(JSON.stringify(request)) as { changes: { dueDate: string } }).changes.dueDate;
}

/** The day the task list shows for a stored due date. */
const listShows = (stored: string) => formatDate(dueDateShown(stored) as Date | string, 'mediumDate', 'en-US');

describe('due dates picked in one zone and read in another', () => {
	it('switches the clock’s zone for real (the cases below would hold in one zone)', () => {
		expect(inZone(PICKER_ZONE, () => new Date(2026, 10, 14).getTimezoneOffset())).toBe(240);
		expect(inZone(READER_ZONE, () => new Date(2026, 10, 14).getTimezoneOffset())).toBe(-120);
	});

	it('keeps 14 Nov picked in UTC−4 on 14 Nov for a reader in UTC+2: the list, the timeline and lateness', () => {
		const stored = inZone(PICKER_ZONE, () => pickedAndSent('2026-11-14'));
		expect(stored).toBe('2026-11-14T00:00:00.000Z');

		inZone(READER_ZONE, () => {
			expect(listShows(stored)).toBe('Nov 14, 2026');
			expect(dayOfStoredDate(stored)).toBe(dayNumberOf(new Date(2026, 10, 14)));
			const open = { dueDate: stored as never, status: TaskStatusEnum.OPEN };
			expect(isOverdue(open, new Date(2026, 10, 14, 23, 30).getTime())).toBe(false);
			expect(isOverdue(open, new Date(2026, 10, 15, 0, 30).getTime())).toBe(true);
		});
	});

	it('keeps the day the other way round too, and for the picker itself', () => {
		const stored = inZone(READER_ZONE, () => pickedAndSent('2026-11-14'));
		expect(stored).toBe('2026-11-14T00:00:00.000Z');
		for (const zone of [PICKER_ZONE, 'America/Los_Angeles', 'Pacific/Auckland', 'UTC', READER_ZONE]) {
			inZone(zone, () => {
				expect(`${zone} ${listShows(stored)}`).toBe(`${zone} Nov 14, 2026`);
				expect(`${zone} ${dayOfStoredDate(stored)}`).toBe(`${zone} ${dayNumberOf(new Date(2026, 10, 14))}`);
			});
		}
	});

	it('is not late on its own day in a zone west of UTC, where midnight UTC is the evening before', () => {
		inZone(PICKER_ZONE, () => {
			const open = { dueDate: new Date('2026-11-14T00:00:00.000Z'), status: TaskStatusEnum.OPEN };
			expect(isOverdue(open, new Date(2026, 10, 14, 12, 0).getTime())).toBe(false);
			expect(isOverdue(open, new Date(2026, 10, 15, 0, 1).getTime())).toBe(true);
		});
	});
});
