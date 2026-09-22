import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable } from 'rxjs';
import moment from 'moment';
// TYPE-ONLY: a value import from either barrel would pull the app graph into this test, which
// is the very thing the resolver was just changed to avoid.
import type { IDateRangePicker } from '@gauzy/contracts';
import type { IDatePickerConfig } from '@gauzy/ui-core/core';
import { DateRangePickerResolver } from './date-range-picker.resolver';

/**
 * Called directly — the resolver injects nothing, so it needs no `TestBed` (and the ui-core
 * barrel would pull the whole app graph in). Only the two inputs it actually reads are faked:
 * the route's own `datePicker` config and the URL's query parameters.
 */
function resolve(queryParams: Record<string, unknown>, datePicker?: Partial<IDatePickerConfig>): IDateRangePicker {
	const route = {
		queryParams,
		data: datePicker ? { datePicker } : {}
	} as unknown as ActivatedRouteSnapshot;

	let resolved!: IDateRangePicker;
	(DateRangePickerResolver(route, {} as RouterStateSnapshot) as Observable<IDateRangePicker>).subscribe(
		(value) => (resolved = value)
	);
	return resolved;
}

/** Ranges are compared as calendar days; the times either side are start/end of day. */
const day = (date: Date): string => moment(date).format('YYYY-MM-DD');

// 2026-09-23 is a Wednesday: mid-week and mid-month, so a locked route snapping to whole
// periods is visibly different from one that anchors on the date itself.
const WEDNESDAY = '2026-09-23';
const THAT_WEEK: [string, string] = ['2026-09-20', '2026-09-26'];
const THAT_MONTH: [string, string] = ['2026-09-01', '2026-09-30'];

describe('DateRangePickerResolver — the route owns the unit where the picker is locked', () => {
	describe('locked routes ignore a unit_of_time carried over from the page the user came from', () => {
		// The regression this guards: arriving on a day-locked page (Time & Activity, Screenshots,
		// Dashboard -> Teams) from any week page resolved a WEEK range, so the input showed one
		// date while a whole week was loaded.
		it.each([
			['day', 'week', WEDNESDAY, WEDNESDAY],
			['day', 'month', WEDNESDAY, WEDNESDAY],
			['week', 'day', ...THAT_WEEK],
			['week', 'month', ...THAT_WEEK],
			['month', 'day', ...THAT_MONTH],
			['month', 'week', ...THAT_MONTH]
		])(
			'a %s-locked route stays on its own unit when the URL says %s',
			(unitOfTime, staleUnit, expectedStart, expectedEnd) => {
				const range = resolve(
					{ date: WEDNESDAY, unit_of_time: staleUnit },
					{ unitOfTime: unitOfTime as IDatePickerConfig['unitOfTime'], isLockDatePicker: true }
				);

				expect(range.unitOfTime).toBe(unitOfTime);
				expect(day(range.startDate)).toBe(expectedStart);
				expect(day(range.endDate)).toBe(expectedEnd);
			}
		);

		it.each([['day'], ['week'], ['month']])(
			'a %s-locked route ignores a stale date_end instead of stretching across it',
			(unitOfTime) => {
				const stretched = resolve(
					{ date: WEDNESDAY, date_end: '2026-10-15', is_custom_date: 'true' },
					{ unitOfTime: unitOfTime as IDatePickerConfig['unitOfTime'], isLockDatePicker: true }
				);
				const clean = resolve(
					{ date: WEDNESDAY },
					{ unitOfTime: unitOfTime as IDatePickerConfig['unitOfTime'], isLockDatePicker: true }
				);

				expect(day(stretched.endDate)).toBe(day(clean.endDate));
			}
		);

		it('reports a locked range as not custom, so the arrows step by the unit and not by its span', () => {
			// The arrow strategies measure the span of the range itself when `isCustomDate` is set —
			// that is how a leaked seven-day range made a day page's arrows jump a week at a time.
			const range = resolve(
				{ date: WEDNESDAY, date_end: '2026-10-15', is_custom_date: 'true' },
				{ unitOfTime: 'day', isLockDatePicker: true }
			);

			expect(range.isCustomDate).toBe(false);
		});

		it('snaps a mid-week anchor to the whole week rather than running from the anchor', () => {
			const range = resolve({ date: WEDNESDAY }, { unitOfTime: 'week', isLockDatePicker: true });

			expect([day(range.startDate), day(range.endDate)]).toEqual(THAT_WEEK);
		});
	});

	describe('unlocked routes keep reading the URL, so a range the user picked survives a reload', () => {
		it('honours unit_of_time from the URL over the route default', () => {
			const range = resolve({ unit_of_time: 'month' }, { unitOfTime: 'week' });

			expect(range.unitOfTime).toBe('month');
			expect(day(range.startDate)).toBe(moment().startOf('month').format('YYYY-MM-DD'));
			expect(day(range.endDate)).toBe(moment().endOf('month').format('YYYY-MM-DD'));
		});

		it('preserves an explicit start and end, spanning whatever the user dragged', () => {
			const range = resolve(
				{ date: '2026-09-07', date_end: '2026-09-11', is_custom_date: 'true' },
				{ unitOfTime: 'week' }
			);

			expect(day(range.startDate)).toBe('2026-09-07');
			expect(day(range.endDate)).toBe('2026-09-11');
			expect(range.isCustomDate).toBe(true);
		});

		it('falls back to the route unit when the URL carries none', () => {
			const range = resolve({}, { unitOfTime: 'month' });

			expect(range.unitOfTime).toBe('month');
			expect(day(range.startDate)).toBe(moment().startOf('month').format('YYYY-MM-DD'));
		});

		it('completes a lone date to the end of the route unit', () => {
			const range = resolve({ date: WEDNESDAY }, { unitOfTime: 'week' });

			expect(day(range.startDate)).toBe(WEDNESDAY);
			expect(day(range.endDate)).toBe(THAT_WEEK[1]);
		});
	});

	it('falls back to the default config for a route that declares no datePicker', () => {
		// Reachable from the estimates list route, which resolves dates without declaring a picker;
		// reading `.unitOfTime` off the missing config used to throw.
		expect(() => resolve({})).not.toThrow();
		expect(resolve({}).unitOfTime).toBe('week');
	});
});
