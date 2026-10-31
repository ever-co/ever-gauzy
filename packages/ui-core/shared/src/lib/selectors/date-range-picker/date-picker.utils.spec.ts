import moment from 'moment';
import 'moment-timezone';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import {
	buildPresetRanges,
	PRESET_UNIT_OF_TIME,
	PRESET_UNITS_OF_TIME,
	selectUnitOfTime,
	shiftUTCtoLocal,
	toLocalPickerMoment,
	toPickerDateRange,
	toPickerRange
} from './date-picker.utils';
import { DateRangeKeyEnum } from './date-picker.interface';

dayjs.extend(utc);

/**
 * The precedence rule the header picker applies to decide which unit it runs at. It is exercised
 * here rather than through `DateRangePickerComponent` because the component's decision is the part
 * that can silently regress — and standing the component up would pull the whole app graph into
 * the suite. Each test names the step of a real navigation it stands for.
 */
describe('selectUnitOfTime — the route wins on entry, the URL wins in-page', () => {
	describe('arriving on a route', () => {
		it('takes the unit off a freshly resolved config, whatever the URL still says', () => {
			// Sidebar navigation from a week page onto Time & Activity: the resolver has already
			// settled 'day' for this route, and a `unit_of_time=week` left in the URL by the page
			// the user came from must not survive the move.
			const unit = selectUnitOfTime({
				isNewRouteConfig: true,
				routeUnitOfTime: 'day',
				queryUnitOfTime: 'week',
				currentUnitOfTime: 'week'
			});

			expect(unit).toBe('day');
		});

		it.each([
			['day', 'week'],
			['week', 'day'],
			['month', 'week'],
			['day', 'month']
		])('a %s route overrides a stale %s in the URL', (routeUnitOfTime, queryUnitOfTime) => {
			const unit = selectUnitOfTime({
				isNewRouteConfig: true,
				routeUnitOfTime: routeUnitOfTime as moment.unitOfTime.Base,
				queryUnitOfTime: queryUnitOfTime as moment.unitOfTime.Base,
				currentUnitOfTime: queryUnitOfTime as moment.unitOfTime.Base
			});

			expect(unit).toBe(routeUnitOfTime);
		});

		it('still applies the route unit on the very first emission, when nothing is current yet', () => {
			const unit = selectUnitOfTime({ isNewRouteConfig: true, routeUnitOfTime: 'week' });

			expect(unit).toBe('week');
		});
	});

	describe('staying on a route', () => {
		it('adopts a unit the URL changed to, so a range picked from the menu takes effect', () => {
			// An unlocked reports page: the user clicks "Current Month", the picker writes
			// `unit_of_time=month`, and the same config object comes back around the pipeline.
			const unit = selectUnitOfTime({
				isNewRouteConfig: false,
				routeUnitOfTime: 'week',
				queryUnitOfTime: 'month',
				currentUnitOfTime: 'week'
			});

			expect(unit).toBe('month');
		});

		it('ignores the URL echoing back the unit the picker just wrote', () => {
			// Every write the picker makes comes back as a queryParams emission. Re-applying it
			// would re-derive the range and write again, which is the loop this rule closes.
			const unit = selectUnitOfTime({
				isNewRouteConfig: false,
				routeUnitOfTime: 'week',
				queryUnitOfTime: 'month',
				currentUnitOfTime: 'month'
			});

			expect(unit).toBeNull();
		});

		it('leaves an in-page choice alone when an organization or timezone change re-fires', () => {
			// Same config object, no unit in the URL: nothing has asked for a change, so the month
			// the user picked must not snap back to the route's default week.
			const unit = selectUnitOfTime({
				isNewRouteConfig: false,
				routeUnitOfTime: 'week',
				currentUnitOfTime: 'month'
			});

			expect(unit).toBeNull();
		});

		it('makes no change during the stale window of a route transition', () => {
			// queryParams emits before the new config arrives, pairing the OLD config with the new
			// URL. Deriving here is what wrote a stale unit back into the URL, where it then beat
			// the config that arrived next. Returning null means nothing is written at all.
			const unit = selectUnitOfTime({
				isNewRouteConfig: false,
				routeUnitOfTime: 'week',
				queryUnitOfTime: undefined,
				currentUnitOfTime: 'week'
			});

			expect(unit).toBeNull();
		});
	});
});

/*
 * How `ngx-daterangepicker-material` hands a picked day out. Its dates carry the day in their
 * WALL-CLOCK fields; only the tag differs between library generations:
 * - 22.x (stage, since the 2026-10-13 dependency upgrade) emits LOCAL dayjs objects — its
 *   `toExternalDate` is `dayjs(date.format('YYYY-MM-DDTHH:mm:ss.SSS'))`;
 * - 6.x (production) emitted the same wall clock tagged as UTC (`dayjs(...).utc(true)`).
 *
 * The expectations are written in the machine's local zone (`new Date(y, m, d, ...)`), so every
 * test holds in ANY zone. CI runs in UTC; run the file under a few zones to see the offsets bite,
 * e.g. `TZ=Europe/Paris`, `TZ=America/New_York`, `TZ=Asia/Kolkata`, `TZ=Pacific/Auckland`. The
 * "tagged with any offset" cases fail for offset arithmetic even in UTC.
 */
const WALL_CLOCK = 'YYYY-MM-DDTHH:mm:ss.SSS';
const v22 = (wallClock: string) => dayjs(wallClock);
const v6 = (wallClock: string) => dayjs(wallClock).utc(true);
const local = (year: number, month: number, day: number, hour = 0, minute = 0, second = 0, ms = 0): number =>
	new Date(year, month, day, hour, minute, second, ms).getTime();

describe('toLocalPickerMoment — the picked day is read off the wall clock, never off the offset', () => {
	it.each([
		['22.x, local', v22('2026-10-25T00:00:00.000')],
		['6.x, tagged UTC', v6('2026-10-25T00:00:00.000')],
		['tagged UTC+05:30', dayjs('2026-10-25T00:00:00.000').utcOffset(330, true)],
		['tagged UTC-04:00', dayjs('2026-10-25T00:00:00.000').utcOffset(-240, true)],
		['a moment in Asia/Tokyo', moment.tz('2026-10-25T00:00:00.000', 'Asia/Tokyo')],
		['a moment in America/Los_Angeles', moment.tz('2026-10-25T00:00:00.000', 'America/Los_Angeles')]
	])('reads %s as 25 Oct 00:00 LOCAL', (_shape, picked) => {
		const result = toLocalPickerMoment(picked);

		expect(result.format(WALL_CLOCK)).toBe('2026-10-25T00:00:00.000');
		expect(result.valueOf()).toBe(local(2026, 9, 25));
	});

	it('keeps the milliseconds of an end of day', () => {
		expect(toLocalPickerMoment(v22('2026-10-08T23:59:59.999')).valueOf()).toBe(local(2026, 9, 8, 23, 59, 59, 999));
		expect(toLocalPickerMoment(v6('2026-10-08T23:59:59.999')).valueOf()).toBe(local(2026, 9, 8, 23, 59, 59, 999));
	});

	it('takes a Date as the instant it is', () => {
		const date = new Date(2026, 9, 6, 13, 45);

		expect(toLocalPickerMoment(date).valueOf()).toBe(date.getTime());
	});

	it.each([
		['null', null],
		['undefined', undefined],
		['an invalid dayjs', dayjs('not a date')],
		['an invalid Date', new Date(Number.NaN)],
		['a plain object', { startDate: 1 }]
	])('gives null for %s', (_label, value) => {
		expect(toLocalPickerMoment(value as never)).toBeNull();
	});
});

describe('toPickerRange — the days the user clicked are the days selected', () => {
	afterEach(() => jest.useRealTimers());

	describe('the report: "Today" on 25 Oct 2026, the EU DST switch day, selected 24 Oct', () => {
		beforeEach(() => {
			// 00:30 local on the switch day: in Europe/Paris that is 24 Oct 22:30Z, still CEST.
			jest.useFakeTimers({ now: new Date(2026, 9, 25, 0, 30) });
		});

		// What the library emits for the "Today" preset: it snaps `[moment(), moment()]` to the
		// start and end of the day, then hands the wall clock out.
		it.each([
			['22.x', v22('2026-10-25T00:00:00.000'), v22('2026-10-25T23:59:59.999')],
			['6.x', v6('2026-10-25T00:00:00.000'), v6('2026-10-25T23:59:59.999')]
		])('a day-locked page (Screenshots) selects TODAY, not yesterday (%s)', (_version, startDate, endDate) => {
			const range = toPickerRange({ startDate, endDate }, true, 'day');

			expect(range.startDate.isSame(moment(), 'day')).toBe(true);
			expect(range.startDate.valueOf()).toBe(local(2026, 9, 25));
			// 25 Oct lasts 25 hours in Europe: its end comes from the local zone, not from start + 24h.
			expect(range.endDate.valueOf()).toBe(local(2026, 9, 25, 23, 59, 59, 999));
			expect(range.startDate.format('YYYY-MM-DD')).toBe('2026-10-25');
			expect(range.endDate.format('YYYY-MM-DD')).toBe('2026-10-25');
		});

		it('"Yesterday" selects 24 Oct', () => {
			const range = toPickerRange(
				{ startDate: v22('2026-10-24T00:00:00.000'), endDate: v22('2026-10-24T23:59:59.999') },
				true,
				'day'
			);

			expect(range.startDate.valueOf()).toBe(local(2026, 9, 24));
			expect(range.endDate.valueOf()).toBe(local(2026, 9, 24, 23, 59, 59, 999));
		});

		it('a range across the switch keeps both of its days', () => {
			const range = toPickerRange(
				{ startDate: v22('2026-10-24T00:00:00.000'), endDate: v22('2026-10-25T23:59:59.999') },
				false,
				'day'
			);

			expect(range.startDate.valueOf()).toBe(local(2026, 9, 24));
			expect(range.endDate.valueOf()).toBe(local(2026, 9, 25, 23, 59, 59, 999));
		});
	});

	describe('the report: a range of 6 to 8 Oct was shown as 5 to 8 Oct', () => {
		beforeEach(() => {
			// Picked after the switch: today's offset (CET) differs from the picked days' (CEST).
			jest.useFakeTimers({ now: new Date(2026, 9, 25, 10, 0) });
		});

		it.each([
			['22.x', v22('2026-10-06T00:00:00.000'), v22('2026-10-08T23:59:59.999')],
			['6.x', v6('2026-10-06T00:00:00.000'), v6('2026-10-08T23:59:59.999')]
		])('selects exactly 6 to 8 Oct (%s)', (_version, startDate, endDate) => {
			const range = toPickerRange({ startDate, endDate }, false, 'week');

			expect(range.startDate.valueOf()).toBe(local(2026, 9, 6));
			expect(range.endDate.valueOf()).toBe(local(2026, 9, 8, 23, 59, 59, 999));
		});

		it('a single day selects that whole day', () => {
			const range = toPickerRange(
				{ startDate: v22('2026-10-06T00:00:00.000'), endDate: v22('2026-10-06T00:00:00.000') },
				false,
				'day'
			);

			expect(range.startDate.valueOf()).toBe(local(2026, 9, 6));
			expect(range.endDate.valueOf()).toBe(local(2026, 9, 6, 23, 59, 59, 999));
		});
	});

	it('a locked week or month picker spans the whole unit around the picked start date', () => {
		const picked = { startDate: v22('2026-10-07T00:00:00.000'), endDate: v22('2026-10-07T23:59:59.999') };

		// The first day of the week follows the moment locale, so the expectation asks moment for it.
		const weekStart = moment(local(2026, 9, 7)).startOf('week');
		const weekEnd = moment(local(2026, 9, 7)).endOf('week');
		const week = toPickerRange(picked, true, 'week');
		expect(week.startDate.valueOf()).toBe(weekStart.valueOf());
		expect(week.endDate.valueOf()).toBe(weekEnd.valueOf());

		const month = toPickerRange(picked, true, 'month');
		expect(month.startDate.valueOf()).toBe(local(2026, 9, 1));
		expect(month.endDate.valueOf()).toBe(local(2026, 9, 31, 23, 59, 59, 999));

		const year = toPickerRange(picked, true, 'year');
		expect(year.startDate.valueOf()).toBe(local(2026, 0, 1));
		expect(year.endDate.valueOf()).toBe(local(2026, 11, 31, 23, 59, 59, 999));
	});

	it('gives null while either end is missing', () => {
		expect(toPickerRange({ startDate: v22('2026-10-06T00:00:00.000'), endDate: null }, false, 'day')).toBeNull();
		expect(toPickerRange({ startDate: null, endDate: null }, true, 'day')).toBeNull();
		expect(toPickerRange(null, false, 'day')).toBeNull();
	});

	it('the deprecated UTC shift is what moved 22.x dates: it subtracts the offset from a date already local', () => {
		// Documents the regression rather than guarding the new code: east of UTC the shifted 22.x
		// start lands on the previous day (west of it, the end lands on the next one); in UTC the two agree.
		jest.useFakeTimers({ now: new Date(2026, 9, 25, 10, 0) });
		const picked = v22('2026-10-06T00:00:00.000');
		const offset = moment().utcOffset();

		const shifted = shiftUTCtoLocal({ startDate: picked as never, endDate: picked as never }).startDate;

		expect(shifted.valueOf()).toBe(local(2026, 9, 6) - offset * 60_000);
		expect(toLocalPickerMoment(picked).valueOf()).toBe(local(2026, 9, 6));
	});
});

describe("toPickerDateRange — the library's ngModel echo becomes the Dates it stands for", () => {
	it('turns dayjs objects into local Dates of the same wall clock (moment() would read them as TODAY)', () => {
		const range = toPickerDateRange({
			startDate: v22('2026-10-06T00:00:00.000'),
			endDate: v6('2026-10-08T23:59:59.999'),
			isCustomDate: true
		});

		expect(range.startDate).toBeInstanceOf(Date);
		expect((range.startDate as unknown as Date).getTime()).toBe(local(2026, 9, 6));
		expect((range.endDate as unknown as Date).getTime()).toBe(local(2026, 9, 8, 23, 59, 59, 999));
		expect(range.isCustomDate).toBe(true);
	});

	it('leaves a range of Dates untouched, identity included', () => {
		const range = { startDate: new Date(2026, 9, 6), endDate: new Date(2026, 9, 8, 23, 59, 59, 999) };

		expect(toPickerDateRange(range)).toBe(range);
	});

	it('leaves moments, strings and empty values alone', () => {
		const withMoment = { startDate: moment(local(2026, 9, 6)), endDate: '2026-10-08' };

		expect(toPickerDateRange(withMoment)).toBe(withMoment);
		expect(toPickerDateRange(null)).toBeNull();
	});
});

describe('buildPresetRanges — the menu offers whole days, weeks, months and years', () => {
	// 23 Sep 2026, a Wednesday: mid-week, mid-month and mid-year, so every whole unit is visibly
	// different from the instant itself. Built from LOCAL parts so the day is the same in every zone.
	const NOW = moment(local(2026, 8, 23, 15, 30));
	const day = (value: moment.Moment): string => value.format('YYYY-MM-DD');
	const span = ([start, end]: [moment.Moment, moment.Moment]): [string, string] => [day(start), day(end)];

	it('lists every unit of an unlocked picker, current before last, in menu order', () => {
		const ranges = buildPresetRanges(PRESET_UNITS_OF_TIME, NOW);

		expect(Object.keys(ranges)).toEqual([
			DateRangeKeyEnum.TODAY,
			DateRangeKeyEnum.YESTERDAY,
			DateRangeKeyEnum.CURRENT_WEEK,
			DateRangeKeyEnum.LAST_WEEK,
			DateRangeKeyEnum.CURRENT_MONTH,
			DateRangeKeyEnum.LAST_MONTH,
			DateRangeKeyEnum.CURRENT_YEAR,
			DateRangeKeyEnum.LAST_YEAR
		]);
	});

	it('"Current Year" is 1 Jan to 31 Dec of this year, "Last Year" the whole year before', () => {
		const ranges = buildPresetRanges(PRESET_UNITS_OF_TIME, NOW);

		expect(span(ranges[DateRangeKeyEnum.CURRENT_YEAR])).toEqual(['2026-01-01', '2026-12-31']);
		expect(span(ranges[DateRangeKeyEnum.LAST_YEAR])).toEqual(['2025-01-01', '2025-12-31']);
		expect(ranges[DateRangeKeyEnum.CURRENT_YEAR][0].valueOf()).toBe(local(2026, 0, 1));
		expect(ranges[DateRangeKeyEnum.CURRENT_YEAR][1].valueOf()).toBe(local(2026, 11, 31, 23, 59, 59, 999));
	});

	it('keeps the day, week and month presets the menu always offered', () => {
		const ranges = buildPresetRanges(PRESET_UNITS_OF_TIME, NOW);
		// The first day of the week follows the moment locale, so the expectation asks moment for it.
		const weekStart = NOW.clone().startOf('week');

		expect(span(ranges[DateRangeKeyEnum.TODAY])).toEqual(['2026-09-23', '2026-09-23']);
		expect(span(ranges[DateRangeKeyEnum.YESTERDAY])).toEqual(['2026-09-22', '2026-09-22']);
		expect(span(ranges[DateRangeKeyEnum.CURRENT_WEEK])).toEqual([
			day(weekStart),
			day(weekStart.clone().endOf('week'))
		]);
		expect(span(ranges[DateRangeKeyEnum.LAST_WEEK])).toEqual([
			day(weekStart.clone().subtract(1, 'week')),
			day(weekStart.clone().subtract(1, 'week').endOf('week'))
		]);
		expect(span(ranges[DateRangeKeyEnum.CURRENT_MONTH])).toEqual(['2026-09-01', '2026-09-30']);
		expect(span(ranges[DateRangeKeyEnum.LAST_MONTH])).toEqual(['2026-08-01', '2026-08-31']);
	});

	it('steps back a whole unit even from the last day of a long month', () => {
		const ranges = buildPresetRanges(['month'], moment(local(2026, 2, 31, 12)));

		expect(span(ranges[DateRangeKeyEnum.LAST_MONTH])).toEqual(['2026-02-01', '2026-02-28']);
	});

	it.each([['day'], ['week'], ['month'], ['year']])('a picker locked to %s offers only that unit', (unit) => {
		const ranges = buildPresetRanges([unit as moment.unitOfTime.Base], NOW);

		expect(Object.keys(ranges)).toHaveLength(2);
		expect(Object.keys(ranges).every((label) => PRESET_UNIT_OF_TIME[label as DateRangeKeyEnum] === unit)).toBe(
			true
		);
	});

	it('skips a unit that has no presets', () => {
		expect(buildPresetRanges(['hour'], NOW)).toEqual({});
	});

	describe('where future dates are not allowed', () => {
		const ranges = buildPresetRanges(PRESET_UNITS_OF_TIME, NOW, NOW.clone());

		it('ends the current week, month and year today', () => {
			expect(span(ranges[DateRangeKeyEnum.CURRENT_YEAR])).toEqual(['2026-01-01', '2026-09-23']);
			expect(span(ranges[DateRangeKeyEnum.CURRENT_MONTH])).toEqual(['2026-09-01', '2026-09-23']);
			expect(ranges[DateRangeKeyEnum.CURRENT_WEEK][1].valueOf()).toBe(NOW.valueOf());
		});

		it('leaves the ranges that are already over untouched', () => {
			expect(span(ranges[DateRangeKeyEnum.LAST_YEAR])).toEqual(['2025-01-01', '2025-12-31']);
			expect(span(ranges[DateRangeKeyEnum.LAST_MONTH])).toEqual(['2026-08-01', '2026-08-31']);
			expect(span(ranges[DateRangeKeyEnum.YESTERDAY])).toEqual(['2026-09-22', '2026-09-22']);
		});
	});
});

describe('PRESET_UNIT_OF_TIME — picking a preset sets the unit the arrows step by', () => {
	it('maps every preset label, the year presets to year', () => {
		expect(Object.keys(PRESET_UNIT_OF_TIME).sort()).toEqual(Object.values(DateRangeKeyEnum).sort());
		expect(PRESET_UNIT_OF_TIME[DateRangeKeyEnum.CURRENT_YEAR]).toBe('year');
		expect(PRESET_UNIT_OF_TIME[DateRangeKeyEnum.LAST_YEAR]).toBe('year');
	});
});
