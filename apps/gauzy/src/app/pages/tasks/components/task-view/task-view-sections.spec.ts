import { formatDate } from '@angular/common';
import { runInThisContext } from 'node:vm';
import { ITask, TaskStatusEnum } from '@gauzy/contracts';
import { buildTaskViewSections } from './task-view-sections';

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

const text = { translate: (key: string) => key, hash: (value: number | string) => `#${value}` };

/** The due-date row of a task's Details panel. */
function dueRow(task: Partial<ITask>) {
	const [details] = buildTaskViewSections(task as ITask, text);
	const row = details.fields.find((field) => field.label === 'TASKS_PAGE.DUE_DATE');
	if (!row) throw new Error('The Details panel has no due date row.');
	return row;
}

describe('buildTaskViewSections: the due date', () => {
	afterEach(() => jest.useRealTimers());

	it('shows a date-only due date (midnight UTC) as its own day to a reader west of UTC, not late on that day', () => {
		inZone('America/Caracas', () => {
			expect(new Date(2026, 10, 14).getTimezoneOffset()).toBe(240);
			const task = { dueDate: '2026-11-14T00:00:00.000Z' as never, status: TaskStatusEnum.OPEN };

			jest.useFakeTimers({ now: new Date(2026, 10, 14, 12, 0) });
			const row = dueRow(task);
			expect(formatDate(row.value, 'mediumDate', 'en-US')).toBe('Nov 14, 2026');
			expect(row.tone).toBeUndefined();

			jest.setSystemTime(new Date(2026, 10, 15, 0, 1));
			expect(dueRow(task).tone).toBe('danger');
		});
	});

	it('shows a due date with a time of day as that moment, late once it passed, and nothing when there is none', () => {
		const moment = '2026-11-14T15:30:00.000Z';
		jest.useFakeTimers({ now: new Date('2026-11-14T15:00:00.000Z') });
		expect(dueRow({ dueDate: moment as never, status: TaskStatusEnum.OPEN }).value).toBe(moment);
		expect(dueRow({ dueDate: moment as never, status: TaskStatusEnum.OPEN }).tone).toBeUndefined();
		jest.setSystemTime(new Date('2026-11-14T16:00:00.000Z'));
		expect(dueRow({ dueDate: moment as never, status: TaskStatusEnum.OPEN }).tone).toBe('danger');
		expect(dueRow({ dueDate: moment as never, status: TaskStatusEnum.DONE }).tone).toBeUndefined();
		expect(dueRow({ dueDate: null as never }).value).toBeNull();
	});
});
