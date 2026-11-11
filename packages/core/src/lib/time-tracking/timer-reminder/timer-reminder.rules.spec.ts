import {
	DEFAULT_TIMER_REMINDER_HOURS,
	instantOf,
	notificationPreferencesOf,
	timerReminderHoursOf,
	timerReminderLevelAt,
	timerReminderNotice
} from './timer-reminder.rules';

const HOUR = 60 * 60 * 1000;

describe('the threshold of the timer reminders', () => {
	it('reads the preferences stored as an object or as JSON, and nothing from anything else', () => {
		expect(notificationPreferencesOf({ timerReminderHours: 4 })).toEqual({ timerReminderHours: 4 });
		expect(notificationPreferencesOf('{"timerReminderHours":4}')).toEqual({ timerReminderHours: 4 });
		expect(notificationPreferencesOf('{oops')).toEqual({});
		expect(notificationPreferencesOf('[1]')).toEqual({});
		expect(notificationPreferencesOf(null)).toEqual({});
	});

	it("is the employee's own, eight hours when they chose none, and none when they turned the reminders off", () => {
		expect(timerReminderHoursOf({ timerReminderHours: 4 })).toBe(4);
		expect(timerReminderHoursOf('{"timerReminderHours":12}')).toBe(12);
		expect(timerReminderHoursOf({})).toBe(DEFAULT_TIMER_REMINDER_HOURS);
		expect(timerReminderHoursOf(undefined)).toBe(DEFAULT_TIMER_REMINDER_HOURS);
		expect(timerReminderHoursOf({ timerReminderHours: null })).toBeNull();
		expect(timerReminderHoursOf({ timerReminderHours: 0 })).toBeNull();
	});

	it('reads a value that is not a number of hours in (0, 24] as the default, as the Ever Teams settings do', () => {
		for (const hours of [-1, 25, Number.NaN, '6', true]) {
			expect(timerReminderHoursOf({ timerReminderHours: hours as never })).toBe(DEFAULT_TIMER_REMINDER_HOURS);
		}
		expect(timerReminderHoursOf({ timerReminderHours: 1.5 })).toBe(1.5);
		expect(timerReminderHoursOf({ timerReminderHours: 24 })).toBe(24);
	});

	it('is kept to the hundredth, as the title names it, and one the title cannot name is the default', () => {
		expect(timerReminderHoursOf({ timerReminderHours: 1.234 })).toBe(1.23);
		expect(timerReminderHoursOf({ timerReminderHours: 0.01 })).toBe(0.01);
		// `0 hours` would be its title
		expect(timerReminderHoursOf({ timerReminderHours: 0.004 })).toBe(DEFAULT_TIMER_REMINDER_HOURS);
		expect(timerReminderHoursOf({ timerReminderHours: 24.004 })).toBe(24);
		expect(timerReminderHoursOf({ timerReminderHours: 24.006 })).toBe(DEFAULT_TIMER_REMINDER_HOURS);
	});
});

describe('the reminder a run has reached', () => {
	it('is none before the threshold, the first at it, the second at twice it, and never a third', () => {
		expect(timerReminderLevelAt(8 * HOUR - 1, 8)).toBe(0);
		expect(timerReminderLevelAt(8 * HOUR, 8)).toBe(1);
		expect(timerReminderLevelAt(16 * HOUR - 1, 8)).toBe(1);
		expect(timerReminderLevelAt(16 * HOUR, 8)).toBe(2);
		expect(timerReminderLevelAt(100 * HOUR, 8)).toBe(2);
	});

	it('is none for a start it cannot read or a threshold that is not one', () => {
		expect(timerReminderLevelAt(Number.NaN, 8)).toBe(0);
		expect(timerReminderLevelAt(10 * HOUR, 0)).toBe(0);
	});
});

describe('the times of a run', () => {
	it('reads the times a raw SQLite read answers as UTC', () => {
		expect(instantOf('2026-11-11 08:00:00.000')).toBe(Date.parse('2026-11-11T08:00:00.000Z'));
		expect(instantOf('2026-11-11T08:00:00Z')).toBe(Date.parse('2026-11-11T08:00:00.000Z'));
		expect(instantOf(new Date('2026-11-11T08:00:00.000Z'))).toBe(Date.parse('2026-11-11T08:00:00.000Z'));
		expect(instantOf(null)).toBeNaN();
	});
});

describe('the text of a reminder', () => {
	it('names the hours the run reached, the second reminder twice the threshold', () => {
		expect(timerReminderNotice(1, 8)).toEqual({
			title: 'Your timer has been running for 8 hours',
			message: 'Stop it if you are done, or keep it running.'
		});
		expect(timerReminderNotice(2, 8)).toEqual({
			title: 'Your timer is still running after 16 hours',
			message: 'Did you forget it? Stop it, then correct the time in your timesheet if needed.'
		});
		expect(timerReminderNotice(1, 1).title).toBe('Your timer has been running for 1 hour');
		expect(timerReminderNotice(1, 1.5).title).toBe('Your timer has been running for 1.5 hours');
	});

	it("quotes the run's task, on one line and cut to fit the column", () => {
		expect(timerReminderNotice(1, 8, '  Fix the\nlogin page ').title).toBe(
			'Your timer has been running for 8 hours on "Fix the login page"'
		);
		const long = timerReminderNotice(2, 4, 'x'.repeat(500)).title;
		expect(long.length).toBeLessThanOrEqual(255);
		expect(long).toMatch(/^Your timer is still running after 8 hours on "x+…"$/);
		expect(timerReminderNotice(1, 8, '   ').title).toBe('Your timer has been running for 8 hours');
	});
});

/**
 * The titles are a contract with Ever Teams, which reads the level and the hours back from them
 * (`timerReminderNoticeOf` in apps/web/core/lib/notifications/timer-reminders.ts) and pins the same strings in its
 * test "the titles Gauzy files". A change here is a change there.
 */
describe('the titles Ever Teams reads back', () => {
	it.each([
		[1, 8, null, 'Your timer has been running for 8 hours'],
		[1, 1, null, 'Your timer has been running for 1 hour'],
		[1, 1.5, null, 'Your timer has been running for 1.5 hours'],
		[1, 1.23, null, 'Your timer has been running for 1.23 hours'],
		[1, 8, 'Fix the login page', 'Your timer has been running for 8 hours on "Fix the login page"'],
		[2, 8, null, 'Your timer is still running after 16 hours'],
		[2, 0.5, null, 'Your timer is still running after 1 hour'],
		[2, 1.23, null, 'Your timer is still running after 2.46 hours'],
		[2, 4, 'Ship it', 'Your timer is still running after 8 hours on "Ship it"']
	] as const)('level %s at a threshold of %s hours, task %s: "%s"', (level, hours, task, title) => {
		expect(timerReminderNotice(level, hours, task).title).toBe(title);
	});
});
