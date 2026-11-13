import { formatDate } from '@angular/common';
import { ITaskBulkUpdateInput, TaskStatusEnum } from '@gauzy/contracts';
import { isOverdue } from '../components/task-list/task-list.component';
import { bulkRequest, dueDateChanges } from './bulk-undo';
import { dayOfDateOnly, dueDateShown, dueDeadline } from './due-date';
import { dayNumberOf, dayOfStoredDate } from './timeline';

/** UTC−4 all year (no daylight saving), and UTC+2 all year. */
const PICKER_ZONE = 'America/Caracas';
const READER_ZONE = 'Africa/Johannesburg';

/** Runs `body` with the process in `zone`, as a browser there would be. */
function inZone<T>(zone: string, body: () => T): T {
	const previous = process.env['TZ'];
	process.env['TZ'] = zone;
	try {
		return body();
	} finally {
		if (previous === undefined) delete process.env['TZ'];
		else process.env['TZ'] = previous;
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
const listShows = (stored: string) => formatDate(dueDateShown(stored) as string, 'mediumDate', 'en-US');

describe('due dates picked in one zone and read in another', () => {
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
		for (const zone of [PICKER_ZONE, 'America/Los_Angeles', 'Pacific/Kiritimati', 'UTC', READER_ZONE]) {
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

describe('date-only values', () => {
	it('reads a bare day and midnight UTC as a day, and any other moment as a moment', () => {
		expect(dayOfDateOnly('2026-11-14')).toEqual([2026, 10, 14]);
		expect(dayOfDateOnly('2026-11-14T00:00:00.000Z')).toEqual([2026, 10, 14]);
		expect(dayOfDateOnly(new Date('2026-11-14T00:00:00+00:00'))).toEqual([2026, 10, 14]);
		expect(dayOfDateOnly('2026-11-15T03:59:59.000Z')).toBeNull();
		expect(dayOfDateOnly('not a date')).toBeNull();
		expect(dayOfDateOnly(null)).toBeNull();
		expect(dayOfDateOnly('')).toBeNull();
	});

	it('shows a moment (a due date written before this change) in the reader’s zone, as before', () => {
		// The end of 14 Nov in UTC−4: a reader in UTC+2 reads it as the 15th, which is what it is as a moment.
		const moment = '2026-11-15T03:59:59.000Z';
		expect(dueDateShown(moment)).toBe(moment);
		inZone(READER_ZONE, () => expect(listShows(moment)).toBe('Nov 15, 2026'));
		expect(dueDeadline(moment)).toBe(Date.parse(moment));
		expect(dueDateShown(null)).toBeNull();
		expect(dueDeadline(undefined)).toBeNull();
		expect(dueDeadline('not a date')).toBeNull();
	});
});
