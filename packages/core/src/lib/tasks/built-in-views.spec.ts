import { TaskBuiltInViewEnum } from '@gauzy/contracts';
import { builtInViewWindow, dayIn, isBuiltInView, isKnownTimeZone, startOfDayIn, startOfWeekIn, zoneOffsetMinutes } from './built-in-views';

describe('built-in views', () => {
	// Wednesday 2026-11-04 10:30 UTC
	const now = new Date('2026-11-04T10:30:00.000Z');

	it('knows the keys and the time zones', () => {
		expect(isBuiltInView('mine')).toBe(true);
		expect(isBuiltInView('this-week')).toBe(true);
		expect(isBuiltInView('weird')).toBe(false);
		expect(isKnownTimeZone('Europe/Sofia')).toBe(true);
		expect(isKnownTimeZone('Mars/Olympus')).toBe(false);
		expect(isKnownTimeZone(null)).toBe(false);
	});

	it('computes offsets and day starts in a zone', () => {
		expect(zoneOffsetMinutes(now, 'UTC')).toBe(0);
		expect(zoneOffsetMinutes(now, 'Europe/Sofia')).toBe(120);
		expect(zoneOffsetMinutes(now, 'America/New_York')).toBe(-300);
		expect(startOfDayIn(now, 'UTC').toISOString()).toBe('2026-11-04T00:00:00.000Z');
		expect(startOfDayIn(now, 'Europe/Sofia').toISOString()).toBe('2026-11-03T22:00:00.000Z');
		// 01:30 UTC on the 4th is still the 3rd in New York.
		expect(startOfDayIn(new Date('2026-11-04T01:30:00.000Z'), 'America/New_York').toISOString()).toBe('2026-11-03T05:00:00.000Z');
	});

	it('starts the week on Monday in the zone', () => {
		expect(startOfWeekIn(now, 'UTC').toISOString()).toBe('2026-11-02T00:00:00.000Z');
		expect(startOfWeekIn(now, 'Europe/Sofia').toISOString()).toBe('2026-11-01T22:00:00.000Z');
		// A Sunday belongs to the week that started the Monday before.
		expect(startOfWeekIn(new Date('2026-11-08T12:00:00.000Z'), 'UTC').toISOString()).toBe('2026-11-02T00:00:00.000Z');
	});

	it('builds the windows', () => {
		expect(builtInViewWindow(TaskBuiltInViewEnum.MINE, now)).toEqual({ mine: true, openOnly: false });
		const week = builtInViewWindow(TaskBuiltInViewEnum.THIS_WEEK, now, 'UTC');
		expect(week.dueDateFrom?.toISOString()).toBe('2026-11-02T00:00:00.000Z');
		expect(week.dueDateTo?.toISOString()).toBe('2026-11-08T23:59:59.999Z');
		const overdue = builtInViewWindow(TaskBuiltInViewEnum.OVERDUE, now, 'Europe/Sofia');
		expect(overdue.dueDateFrom).toBeUndefined();
		expect(overdue.dueDateTo?.toISOString()).toBe('2026-11-03T21:59:59.999Z');
		expect(overdue.openOnly).toBe(true);
		const soon = builtInViewWindow(TaskBuiltInViewEnum.DUE_SOON, now, 'UTC');
		expect(soon.dueDateFrom?.toISOString()).toBe('2026-11-04T00:00:00.000Z');
		expect(soon.dueDateTo?.toISOString()).toBe('2026-11-11T23:59:59.999Z');
		// An unknown zone falls back to UTC.
		expect(builtInViewWindow(TaskBuiltInViewEnum.DUE_SOON, now, 'Mars/Olympus').dueDateFrom?.toISOString()).toBe('2026-11-04T00:00:00.000Z');
	});

	it("names the first and last day of each window in the reader's zone, for date-only due dates", () => {
		// 01:30 UTC on Wednesday the 4th: still Tuesday the 3rd in Caracas (UTC−4), already the 4th in Johannesburg (UTC+2).
		const early = new Date('2026-11-04T01:30:00.000Z');
		const days = (key: TaskBuiltInViewEnum, timeZone?: string) => {
			const window = builtInViewWindow(key, early, timeZone);
			return [window.dueDateFromDay, window.dueDateToDay];
		};
		expect(days(TaskBuiltInViewEnum.OVERDUE, 'America/Caracas')).toEqual([undefined, '2026-11-02']);
		expect(days(TaskBuiltInViewEnum.OVERDUE, 'Africa/Johannesburg')).toEqual([undefined, '2026-11-03']);
		expect(days(TaskBuiltInViewEnum.DUE_SOON, 'America/Caracas')).toEqual(['2026-11-03', '2026-11-10']);
		expect(days(TaskBuiltInViewEnum.THIS_WEEK, 'America/Caracas')).toEqual(['2026-11-02', '2026-11-08']);
		// No zone (or one the runtime does not know): the day is UTC's, never the server's own zone.
		expect(days(TaskBuiltInViewEnum.DUE_SOON)).toEqual(['2026-11-04', '2026-11-11']);
		expect(days(TaskBuiltInViewEnum.DUE_SOON, 'Mars/Olympus')).toEqual(['2026-11-04', '2026-11-11']);
		expect(days(TaskBuiltInViewEnum.MINE, 'America/Caracas')).toEqual([undefined, undefined]);
		expect(dayIn(new Date('2026-11-04T03:59:59.999Z'), 'America/Caracas')).toBe('2026-11-03');
	});
});
