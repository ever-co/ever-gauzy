import moment from 'moment';
import { toUtcOffset } from '@gauzy/ui-core/common';
import { DateRangePickerBuilderService } from './date-range-picker-builder.service';

/**
 * Regression tests for the day the picker lands on after a record is created.
 *
 * The bug these pin down cost a CI cycle to find and is invisible to most developers, because it only
 * appears when the BROWSER's timezone disagrees with the ORGANIZATION's across midnight:
 *
 *   - callers pass an INSTANT (a time log's `startedAt`), not a wall-clock day;
 *   - the picker's value is a wall-clock day that is later re-interpreted in the ORG timezone
 *     (serialized to the URL as 'YYYY-MM-DD', read back with a UTC offset);
 *   - so truncating the instant with `startOf()` in the BROWSER's zone can select the previous day,
 *     and the daily grid then queries a window the new record is not in and shows "No Data".
 *
 * The e2e suite hit this ~54% of runs because `organization.seed.ts` picks the org timezone at
 * random and the failure depends only on the sign of its offset.
 */
describe('DateRangePickerBuilderService — day selection across timezones', () => {
	let service: DateRangePickerBuilderService;

	beforeEach(() => {
		service = new DateRangePickerBuilderService();
		service.setDatePickerConfig({
			unitOfTime: 'day',
			isLockDatePicker: false,
			isSaveDatePicker: false,
			isSingleDatePicker: true,
			isDisableFutureDate: false,
			isDisablePastDate: false
		});
	});

	/** The picker stores browser-local Dates; the day it represents is what gets serialized. */
	const selectedDay = (): string => moment(service.selectedDateRange.startDate).format('YYYY-MM-DD');

	describe('when the org is AHEAD of the browser (the failing case)', () => {
		// Midnight of 5 Aug in Asia/Taipei (UTC+8) is 16:00Z on 4 Aug.
		const midnightTaipei5Aug = moment.utc('2026-08-04T16:00:00.000Z');

		it('selects the ORGANIZATION day when the timezone is supplied', () => {
			service.refreshDateRangePicker(midnightTaipei5Aug, 'Asia/Taipei');
			expect(selectedDay()).toBe('2026-08-05');
		});

		it('brackets the instant so the record is inside the queried range', () => {
			service.refreshDateRangePicker(midnightTaipei5Aug, 'Asia/Taipei');
			const { startDate, endDate } = service.selectedDateRange;
			// Assert CONTAINMENT, not merely that both ends format to the right day — an interval
			// inside 2026-08-05 that did not cover the instant would satisfy the latter and still
			// query a window the record is absent from, which is the entire bug.
			//
			// Containment must be checked on the CONVERTED range, not the raw browser-local one. The
			// picker deliberately holds a wall-clock day; the request layer turns it into instants with
			// toUtcOffset(range, orgTimeZone) (base-selector-filter.component.ts). For Asia/Taipei that
			// yields 2026-08-04T16:00Z → 2026-08-05T15:59Z — precisely the window observed in the CI
			// network trace — and the instant sits at its lower bound.
			const queriedFrom = toUtcOffset(startDate, 'Asia/Taipei');
			const queriedTo = toUtcOffset(endDate, 'Asia/Taipei');
			expect(midnightTaipei5Aug.isBetween(queriedFrom, queriedTo, undefined, '[]')).toBe(true);
			expect(moment(startDate).format('YYYY-MM-DD')).toBe('2026-08-05');
			expect(moment(endDate).format('YYYY-MM-DD')).toBe('2026-08-05');
		});
	});

	describe('when the org is BEHIND the browser', () => {
		// Midnight of 5 Aug in America/New_York (UTC-4 in August) is 04:00Z on 5 Aug.
		const midnightNewYork5Aug = moment.utc('2026-08-05T04:00:00.000Z');

		it('still selects the organization day', () => {
			service.refreshDateRangePicker(midnightNewYork5Aug, 'America/New_York');
			expect(selectedDay()).toBe('2026-08-05');
		});

		it('does not drift for an instant late in the org day', () => {
			// 23:30 on 5 Aug in New York is 03:30Z on 6 Aug — the mirror image of the bug.
			service.refreshDateRangePicker(moment.utc('2026-08-06T03:30:00.000Z'), 'America/New_York');
			expect(selectedDay()).toBe('2026-08-05');
		});
	});

	it('is unchanged when no timezone is supplied (callers passing a wall-clock day)', () => {
		// Not every caller deals in instants; those must keep browser-local behaviour exactly.
		const localNoon = moment('2026-08-05T12:00:00');
		service.refreshDateRangePicker(localNoon);
		expect(selectedDay()).toBe('2026-08-05');
	});

	it('handles a week unit the same way', () => {
		service.setDatePickerConfig({
			unitOfTime: 'week',
			isLockDatePicker: false,
			isSaveDatePicker: false,
			isSingleDatePicker: false,
			isDisableFutureDate: false,
			isDisablePastDate: false
		});
		// Sunday 2 Aug 2026 00:00 Taipei = 1 Aug 16:00Z — a browser behind would pick the prior week.
		service.refreshDateRangePicker(moment.utc('2026-08-01T16:00:00.000Z'), 'Asia/Taipei');
		const start = moment(service.selectedDateRange.startDate);
		const end = moment(service.selectedDateRange.endDate);
		expect(moment('2026-08-02').isBetween(start, end, 'day', '[]')).toBe(true);
	});
});
