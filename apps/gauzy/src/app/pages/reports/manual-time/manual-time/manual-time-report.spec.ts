import { ITimeLog } from '@gauzy/contracts';
import {
	buildManualTimeExportTable,
	changedAtOf,
	dayOf,
	EMPTY_MANUAL_TIME_SUMMARY,
	groupManualTimeLogsByDay,
	isEditedLog,
	projectLinkOf,
	summarizeManualTimeLogs,
	taskLinkOf
} from './manual-time-report';

const log = (overrides: Partial<ITimeLog>): ITimeLog =>
	({
		id: overrides.id ?? 'log',
		employeeId: 'employee-1',
		duration: 0,
		...overrides
	} as ITimeLog);

describe('manual time report', () => {
	describe('dayOf', () => {
		it('reads the day in the report time zone, not in UTC', () => {
			// 23:30 UTC on the 1st is already the 2nd in Kigali (UTC+2) and still the 1st in New York
			expect(dayOf('2026-11-01T23:30:00.000Z', 'Africa/Kigali')).toBe('2026-11-02');
			expect(dayOf('2026-11-01T23:30:00.000Z', 'America/New_York')).toBe('2026-11-01');
		});
	});

	describe('isEditedLog / changedAtOf', () => {
		it('treats an entry with an edit time as edited and dates it by that edit', () => {
			const edited = log({ editedAt: new Date('2026-11-03T10:00:00Z'), createdAt: new Date('2026-11-01T10:00:00Z') });
			expect(isEditedLog(edited)).toBe(true);
			expect(changedAtOf(edited)).toEqual(new Date('2026-11-03T10:00:00Z'));
		});

		it('dates an added entry by its creation', () => {
			const added = log({ createdAt: new Date('2026-11-01T10:00:00Z') });
			expect(isEditedLog(added)).toBe(false);
			expect(changedAtOf(added)).toEqual(new Date('2026-11-01T10:00:00Z'));
		});
	});

	describe('groupManualTimeLogsByDay', () => {
		it('groups by start day, oldest first, with each day total', () => {
			const days = groupManualTimeLogsByDay(
				[
					log({ id: 'b', startedAt: new Date('2026-11-03T09:00:00Z'), duration: 600 }),
					log({ id: 'a', startedAt: new Date('2026-11-02T09:00:00Z'), duration: 1800 }),
					log({ id: 'c', startedAt: new Date('2026-11-03T12:00:00Z'), duration: 300 })
				],
				'Etc/UTC'
			);
			expect(days.map((day) => day.date)).toEqual(['2026-11-02', '2026-11-03']);
			expect(days[1].timeLogs.map((entry) => entry.id)).toEqual(['b', 'c']);
			expect(days[1].duration).toBe(900);
		});

		it('returns nothing for no entries', () => {
			expect(groupManualTimeLogsByDay(null)).toEqual([]);
		});
	});

	describe('summarizeManualTimeLogs', () => {
		it('counts added and edited entries, distinct employees and the total time', () => {
			const summary = summarizeManualTimeLogs([
				log({ employeeId: 'e1', duration: 3600 }),
				log({ employeeId: 'e1', duration: 1800, editedAt: new Date() }),
				log({ employeeId: 'e2', duration: 900 })
			]);
			expect(summary).toEqual({ duration: 6300, entries: 3, added: 2, edited: 1, employees: 2 });
		});

		it('is empty for no entries', () => {
			expect(summarizeManualTimeLogs([])).toBe(EMPTY_MANUAL_TIME_SUMMARY);
		});
	});

	describe('projectLinkOf / taskLinkOf', () => {
		it("link to the project's and the task's own pages", () => {
			const entry = log({ project: { id: 'p1' } as ITimeLog['project'], taskId: 't1' });

			expect(projectLinkOf(entry)).toEqual(['/pages/organization/projects/view', 'p1']);
			expect(taskLinkOf(entry)).toEqual(['/pages/tasks/view', 't1']);
		});

		it('link nowhere for an entry without a project or a task', () => {
			expect(projectLinkOf(log({}))).toBeNull();
			expect(taskLinkOf(null)).toBeNull();
		});
	});

	describe('buildManualTimeExportTable', () => {
		it('writes one row per entry, with instants in the report time zone', () => {
			const entry = log({
				startedAt: new Date('2026-11-02T07:00:00Z'),
				stoppedAt: new Date('2026-11-02T08:30:00Z'),
				duration: 5400,
				reason: 'Forgot to start the timer',
				isBillable: true,
				editedAt: new Date('2026-11-04T06:15:00Z'),
				employee: { user: { firstName: 'Ada', lastName: 'Lovelace' } } as ITimeLog['employee'],
				project: { name: 'Gauzy' } as ITimeLog['project'],
				task: { title: 'Reports' } as ITimeLog['task']
			});
			const table = buildManualTimeExportTable([entry], (key) => key, 'Africa/Kigali');
			const row = Object.fromEntries(table.columns.map((column) => [column.key, column.value(entry)]));

			expect(table.rows).toEqual([entry]);
			expect(row).toEqual({
				date: '2026-11-02',
				employee: 'Ada Lovelace',
				project: 'Gauzy',
				task: 'Reports',
				reason: 'Forgot to start the timer',
				start: '09:00:00',
				end: '10:30:00',
				duration: '01:30:00',
				hours: 1.5,
				changedAt: '2026-11-04 08:15:00',
				action: 'REPORT_PAGE.MANUAL_TIME.EDITED',
				billable: 'REPORT_PAGE.MANUAL_TIME.YES'
			});
		});
	});
});
