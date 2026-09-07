import moment from 'moment-timezone';
import {
	emptyMessageKey,
	headerTitleKey,
	isCurrentWeek,
	isMoreThanDays,
	isMoreThanWeek,
	periodCapacity,
	RangePeriod,
	resolveRangePeriod,
	titleMapper,
	widgetTitleKeys,
	WINDOW_TITLE_KEYS
} from './period.utils';

/** A range spanning `days` whole days from a fixed Monday. */
const rangeOf = (days: number, isCustomDate = false) => ({
	startDate: moment('2026-08-10T00:00:00').toDate(),
	endDate: moment('2026-08-10T00:00:00').add(days, 'days').endOf('day').toDate(),
	isCustomDate
});

describe('period.utils — RangePeriod detection (Angular `selectedPeriod` parity)', () => {
	it('is WEEK for exactly six days, DAY for zero and PERIOD for anything else', () => {
		expect(resolveRangePeriod(rangeOf(6))).toBe(RangePeriod.WEEK);
		expect(resolveRangePeriod(rangeOf(0))).toBe(RangePeriod.DAY);
		// The old React hook said `<= 6 → WEEK`; Angular says PERIOD for 1–5 days.
		expect(resolveRangePeriod(rangeOf(1))).toBe(RangePeriod.PERIOD);
		expect(resolveRangePeriod(rangeOf(5))).toBe(RangePeriod.PERIOD);
		expect(resolveRangePeriod(rangeOf(7))).toBe(RangePeriod.PERIOD);
		expect(resolveRangePeriod(rangeOf(30))).toBe(RangePeriod.PERIOD);
	});

	it('is undefined without a range', () => {
		expect(resolveRangePeriod(undefined)).toBeUndefined();
		expect(resolveRangePeriod(null)).toBeUndefined();
	});

	it('detects the current calendar week', () => {
		const now = moment('2026-08-12T10:00:00');
		const thisWeek = { startDate: now.clone().startOf('week').toDate(), endDate: now.clone().endOf('week').toDate() };
		expect(isCurrentWeek(thisWeek, now)).toBe(true);
		const lastWeek = {
			startDate: now.clone().subtract(1, 'week').startOf('week').toDate(),
			endDate: now.clone().subtract(1, 'week').endOf('week').toDate()
		};
		expect(isCurrentWeek(lastWeek, now)).toBe(false);
		expect(isCurrentWeek(undefined, now)).toBe(false);
	});

	it('knows when a range is longer than a day / a week', () => {
		expect(isMoreThanDays(rangeOf(0))).toBe(false);
		expect(isMoreThanDays(rangeOf(1))).toBe(true);
		expect(isMoreThanWeek(rangeOf(6))).toBe(false);
		expect(isMoreThanWeek(rangeOf(7))).toBe(true);
		expect(isMoreThanWeek(undefined)).toBe(false);
	});
});

describe('period.utils — header title (Angular `headerTitle` parity)', () => {
	it('defaults to WEEKLY without a range', () => {
		expect(headerTitleKey(undefined)).toBe('TIMESHEET.WEEKLY');
	});

	it('picks MONTHLY / WEEKLY / DAILY by span', () => {
		expect(headerTitleKey(rangeOf(30))).toBe('TIMESHEET.MONTHLY');
		expect(headerTitleKey(rangeOf(6))).toBe('TIMESHEET.WEEKLY');
		expect(headerTitleKey(rangeOf(0))).toBe('TIMESHEET.DAILY');
	});

	it('has no prefix for a custom range', () => {
		expect(headerTitleKey(rangeOf(6, true))).toBeNull();
	});
});

describe('period.utils — capacity (Angular `period` getter parity)', () => {
	it('is days × working day × employees', () => {
		const org = { defaultStartTime: '09:00', defaultEndTime: '17:00' };
		expect(periodCapacity(rangeOf(6), org, 3)).toBe(7 * 8 * 3600 * 3);
	});

	it('falls back to 24h when the organization has no working hours', () => {
		expect(periodCapacity(rangeOf(0), {}, 2)).toBe(1 * 86400 * 2);
		expect(periodCapacity(rangeOf(0), null, 1)).toBe(86400);
	});

	it('is undefined before counts arrive or without a range', () => {
		expect(periodCapacity(rangeOf(6), {}, undefined)).toBeUndefined();
		expect(periodCapacity(undefined, {}, 4)).toBeUndefined();
	});
});

describe('period.utils — titles (Angular `titleMapper` parity)', () => {
	it('names the six windows', () => {
		expect(WINDOW_TITLE_KEYS).toEqual([
			'TIMESHEET.RECENT_ACTIVITIES',
			'TIMESHEET.MANUAL_TIME',
			'TIMESHEET.TASKS',
			'TIMESHEET.PROJECTS',
			'TIMESHEET.APPS_URLS',
			'TIMESHEET.MEMBERS'
		]);
		expect(titleMapper(5, false, RangePeriod.DAY, false)).toBe('TIMESHEET.MEMBERS');
	});

	it('makes widgets 4 and 5 period-aware', () => {
		expect(widgetTitleKeys(RangePeriod.WEEK, true).slice(4)).toEqual(['TIMESHEET.WORKED_THIS_WEEK', 'TIMESHEET.ACTIVITY_FOR_WEEK']);
		expect(widgetTitleKeys(RangePeriod.WEEK, false).slice(4)).toEqual(['TIMESHEET.WORKED_FOR_WEEK', 'TIMESHEET.ACTIVITY_FOR_WEEK']);
		expect(widgetTitleKeys(RangePeriod.DAY, false).slice(4)).toEqual(['TIMESHEET.WORKED_FOR_DAY', 'TIMESHEET.ACTIVITY_FOR_DAY']);
		expect(widgetTitleKeys(RangePeriod.PERIOD, false).slice(4)).toEqual([
			'TIMESHEET.WORKED_OVER_PERIOD',
			'TIMESHEET.ACTIVITY_OVER_PERIOD'
		]);
		expect(widgetTitleKeys(undefined, true).slice(0, 4)).toEqual([
			'TIMESHEET.MEMBERS_WORKED',
			'TIMESHEET.PROJECTS_WORKED',
			'TIMESHEET.TODAY_ACTIVITY',
			'TIMESHEET.WORKED_TODAY'
		]);
		expect(titleMapper(4, true, RangePeriod.PERIOD, false)).toBe('TIMESHEET.WORKED_OVER_PERIOD');
	});

	it('suffixes empty-state keys with the period (WEEK when unknown)', () => {
		expect(emptyMessageKey('TIMESHEET.NO_SCREENSHOT', RangePeriod.DAY)).toBe('TIMESHEET.NO_SCREENSHOT_DAY');
		expect(emptyMessageKey('TIMESHEET.NO_MEMBER_ACTIVITY', RangePeriod.PERIOD)).toBe('TIMESHEET.NO_MEMBER_ACTIVITY_PERIOD');
		expect(emptyMessageKey('TIMESHEET.NO_TASK_ACTIVITY', undefined)).toBe('TIMESHEET.NO_TASK_ACTIVITY_WEEK');
	});
});
