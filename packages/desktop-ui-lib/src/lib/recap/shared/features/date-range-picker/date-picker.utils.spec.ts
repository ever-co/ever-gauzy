import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import { toLocalPickerMoment, toPickerRange } from './date-picker.utils';

dayjs.extend(utc);

/*
 * The desktop Recap picker reads `ngx-daterangepicker-material` dates the same way as the web
 * header picker (`@gauzy/ui-core/shared`, whose spec covers the cases in depth). 22.x emits LOCAL
 * dayjs objects, 6.x emitted the same wall clock tagged as UTC; both must give the picked local day.
 * Expectations are local (`new Date(y, m, d, ...)`), so the tests hold in any zone — run them with
 * e.g. `TZ=Europe/Paris` or `TZ=America/New_York` to see the offsets bite.
 */
const v22 = (wallClock: string) => dayjs(wallClock);
const v6 = (wallClock: string) => dayjs(wallClock).utc(true);
const local = (year: number, month: number, day: number, hour = 0, minute = 0, second = 0, ms = 0): number =>
	new Date(year, month, day, hour, minute, second, ms).getTime();

describe('Recap date range picker — the days the user clicked are the days selected', () => {
	afterEach(() => jest.useRealTimers());

	it.each([
		['22.x, local', v22('2026-10-25T00:00:00.000')],
		['6.x, tagged UTC', v6('2026-10-25T00:00:00.000')],
		['tagged UTC+05:30', dayjs('2026-10-25T00:00:00.000').utcOffset(330, true)],
		['tagged UTC-04:00', dayjs('2026-10-25T00:00:00.000').utcOffset(-240, true)]
	])('reads %s as 25 Oct 00:00 local', (_shape, picked) => {
		expect(toLocalPickerMoment(picked).valueOf()).toBe(local(2026, 9, 25));
	});

	it('"Today" on the EU DST switch day selects today, not yesterday', () => {
		jest.useFakeTimers({ now: new Date(2026, 9, 25, 0, 30) });

		const range = toPickerRange(
			{ startDate: v22('2026-10-25T00:00:00.000'), endDate: v22('2026-10-25T23:59:59.999') },
			true,
			'day'
		);

		expect(range.startDate.valueOf()).toBe(local(2026, 9, 25));
		expect(range.endDate.valueOf()).toBe(local(2026, 9, 25, 23, 59, 59, 999));
	});

	it.each([
		['22.x', v22('2026-10-06T00:00:00.000'), v22('2026-10-08T23:59:59.999')],
		['6.x', v6('2026-10-06T00:00:00.000'), v6('2026-10-08T23:59:59.999')]
	])('a range of 6 to 8 Oct stays 6 to 8 Oct (%s)', (_version, startDate, endDate) => {
		jest.useFakeTimers({ now: new Date(2026, 9, 25, 10, 0) });

		const range = toPickerRange({ startDate, endDate }, false, 'day');

		expect(range.startDate.valueOf()).toBe(local(2026, 9, 6));
		expect(range.endDate.valueOf()).toBe(local(2026, 9, 8, 23, 59, 59, 999));
	});

	it('gives null while either end is missing', () => {
		expect(toPickerRange({ startDate: v22('2026-10-06T00:00:00.000'), endDate: null }, false, 'day')).toBeNull();
		expect(toLocalPickerMoment(dayjs('not a date'))).toBeNull();
	});
});
