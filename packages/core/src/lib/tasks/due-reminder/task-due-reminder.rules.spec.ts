import {
	DEFAULT_TASK_DUE_REMINDER_HOURS,
	isDayOnlyDueDate,
	isTaskDueReminderDue,
	taskDueMomentOf,
	taskDueReminderHoursOf,
	taskDueReminderNotice
} from './task-due-reminder.rules';

const HOUR = 60 * 60 * 1000;

describe('task due reminder rules', () => {
	describe('taskDueReminderHoursOf', () => {
		it('is a day when the employee chose nothing, or something that is no threshold', () => {
			for (const preferences of [
				undefined,
				null,
				{},
				{ taskDueReminderHours: 'soon' },
				{ taskDueReminderHours: -2 },
				{ taskDueReminderHours: 500 }
			]) {
				expect(taskDueReminderHoursOf(preferences)).toBe(DEFAULT_TASK_DUE_REMINDER_HOURS);
			}
		});

		it('is off when the employee turned the reminders off', () => {
			expect(taskDueReminderHoursOf({ taskDueReminderHours: null })).toBeNull();
			expect(taskDueReminderHoursOf({ taskDueReminderHours: 0 })).toBeNull();
		});

		it("reads the employee's own threshold, from an object or its JSON (SQLite), up to a week", () => {
			expect(taskDueReminderHoursOf({ taskDueReminderHours: 2 })).toBe(2);
			expect(taskDueReminderHoursOf(JSON.stringify({ taskDueReminderHours: 48 }))).toBe(48);
			expect(taskDueReminderHoursOf({ taskDueReminderHours: 168 })).toBe(168);
		});
	});

	describe('taskDueMomentOf', () => {
		it("reads a due date at midnight UTC as a day, due once that day is over in the person's zone", () => {
			const friday = '2026-11-20T00:00:00.000Z';
			expect(isDayOnlyDueDate(friday)).toBe(true);
			// Paris is an hour ahead of UTC in November: its Friday ends at 23:00 UTC
			expect(new Date(taskDueMomentOf(friday, 'Europe/Paris')).toISOString()).toBe('2026-11-20T23:00:00.000Z');
			// Los Angeles is eight hours behind: its Friday ends on Saturday at 08:00 UTC
			expect(new Date(taskDueMomentOf(friday, 'America/Los_Angeles')).toISOString()).toBe(
				'2026-11-21T08:00:00.000Z'
			);
			expect(new Date(taskDueMomentOf(friday, null)).toISOString()).toBe('2026-11-21T00:00:00.000Z');
			expect(new Date(taskDueMomentOf(friday, 'Not/AZone')).toISOString()).toBe('2026-11-21T00:00:00.000Z');
		});

		it('ends a day whose midnight a DST change skips when the next day starts, not an hour later', () => {
			// Asia/Amman went from 00:00 to 01:00 on 2021-03-26: that day ends at 2021-03-27 00:00 (UTC+3)
			expect(new Date(taskDueMomentOf('2021-03-26T00:00:00.000Z', 'Asia/Amman')).toISOString()).toBe(
				'2021-03-26T21:00:00.000Z'
			);
			// and the day before ends when 2021-03-26 starts, at its 01:00 (UTC+3)
			expect(new Date(taskDueMomentOf('2021-03-25T00:00:00.000Z', 'Asia/Amman')).toISOString()).toBe(
				'2021-03-25T22:00:00.000Z'
			);
		});

		it('reads the day of a date-only value as SQLite returns it (UTC text without its zone)', () => {
			expect(new Date(taskDueMomentOf('2026-11-20 00:00:00.000', 'UTC')).toISOString()).toBe(
				'2026-11-21T00:00:00.000Z'
			);
		});

		it('keeps a due date that names a moment, whatever the zone', () => {
			const atNoon = '2026-11-20T12:30:00.000Z';
			expect(isDayOnlyDueDate(atNoon)).toBe(false);
			expect(new Date(taskDueMomentOf(atNoon, 'America/Los_Angeles')).toISOString()).toBe(atNoon);
		});

		it('has no moment without a due date', () => {
			expect(taskDueMomentOf(null, 'UTC')).toBeNaN();
			expect(taskDueMomentOf(undefined, 'UTC')).toBeNaN();
		});
	});

	describe('isTaskDueReminderDue', () => {
		const due = Date.parse('2026-11-20T12:00:00.000Z');

		it('is due from the threshold before the due moment until it', () => {
			expect(isTaskDueReminderDue(due, 24, due - 24 * HOUR - 1)).toBe(false);
			expect(isTaskDueReminderDue(due, 24, due - 24 * HOUR)).toBe(true);
			expect(isTaskDueReminderDue(due, 24, due - 1)).toBe(true);
		});

		it('is not due once the task is due: the moment has passed', () => {
			expect(isTaskDueReminderDue(due, 24, due)).toBe(false);
			expect(isTaskDueReminderDue(due, 24, due + HOUR)).toBe(false);
		});

		it('is never due without a moment or a threshold', () => {
			expect(isTaskDueReminderDue(Number.NaN, 24, due)).toBe(false);
			expect(isTaskDueReminderDue(due, 0, due - HOUR)).toBe(false);
		});
	});

	describe('taskDueReminderNotice', () => {
		const now = Date.parse('2026-11-19T12:00:00.000Z');

		it('quotes the task and says how long is left, with the day a day-only due date names', () => {
			const friday = '2026-11-20T00:00:00.000Z';
			const moment = taskDueMomentOf(friday, 'UTC');
			expect(taskDueReminderNotice('Ship the release', friday, moment, now, 'UTC')).toEqual({
				title: 'The Task "Ship the release" is due in 36 hours',
				message: 'Due by the end of 2026-11-20.'
			});
		});

		it("names the moment in the person's zone when the due date names one", () => {
			const atFive = '2026-11-19T16:00:00.000Z';
			const notice = taskDueReminderNotice('Call back', atFive, Date.parse(atFive), now, 'Europe/Paris');
			expect(notice).toEqual({
				title: 'The Task "Call back" is due in 4 hours',
				message: 'Due at 2026-11-19 17:00 (Europe/Paris).'
			});
		});

		it('says one hour, less than an hour, or days', () => {
			expect(taskDueReminderNotice('A', '2026-11-19T13:30:00.000Z', now + 1.5 * HOUR, now, 'UTC').title).toBe(
				'The Task "A" is due in 1 hour'
			);
			expect(taskDueReminderNotice('A', '2026-11-19T12:20:00.000Z', now + 0.3 * HOUR, now, 'UTC').title).toBe(
				'The Task "A" is due in less than an hour'
			);
			expect(taskDueReminderNotice('A', '2026-11-23T12:00:00.000Z', now + 96 * HOUR, now, 'UTC').title).toBe(
				'The Task "A" is due in 4 days'
			);
		});

		it('shortens a long title so the notification title fits its column, and names a task without one', () => {
			const long = 'x'.repeat(300);
			const { title } = taskDueReminderNotice(long, '2026-11-19T16:00:00.000Z', now + 4 * HOUR, now, 'UTC');
			expect(title.length).toBeLessThan(160);
			expect(title).toContain('…"');
			expect(taskDueReminderNotice('  ', '2026-11-19T16:00:00.000Z', now + 4 * HOUR, now, 'UTC').title).toBe(
				'A task is due in 4 hours'
			);
		});
	});
});
