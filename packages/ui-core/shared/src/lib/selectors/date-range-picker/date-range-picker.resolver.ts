import { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { Observable, of } from 'rxjs';
import moment from 'moment';
import { IDateRangePicker } from '@gauzy/contracts';
import { parseToBoolean } from '@gauzy/ui-core/common';
import { DEFAULT_DATE_PICKER_CONFIG, IDatePickerConfig } from '@gauzy/ui-core/core';

/**
 * Resolves the date range picker configuration based on the route parameters.
 *
 * This resolver is the ONLY place that sees a route's picker configuration and the URL together,
 * and it runs exactly once per resolution — which is what makes it the right owner of the
 * "effective unit of time" for the page. The unit it returns is folded into the date picker
 * config by the app component, so the header picker never has to re-derive it from the URL.
 *
 * @param route The activated route snapshot containing route information.
 * @returns An observable of type `IDateRangePicker` representing the resolved date range picker configuration.
 */
export const DateRangePickerResolver: ResolveFn<Observable<IDateRangePicker>> = (
	route: ActivatedRouteSnapshot
): Observable<IDateRangePicker> => {
	// Extract the date range picker configuration from the route query parameters
	const { date, date_end, unit_of_time, is_custom_date = false } = route.queryParams;

	// The route's own picker configuration. Routes that declare no `datePicker` fall back to the
	// global default instead of throwing on a missing `unitOfTime`.
	const datePicker: IDatePickerConfig = {
		...DEFAULT_DATE_PICKER_CONFIG,
		...((route.data?.datePicker as Partial<IDatePickerConfig>) ?? {})
	};

	// `isLockDatePicker` means the page only works at ONE granularity: a day page (Time & Activity,
	// Screenshots, Videos, Apps, Visited Sites, Daily timesheet) shows the activity of a single date,
	// a weekly page a whole week. The user cannot change that unit there — `createDateRangeMenus`
	// offers only this unit — so a `unit_of_time` left in the URL by a PREVIOUS page must never win.
	// It used to: navigating from any week page landed on Time & Activity with 'week' selected while
	// the input still showed one date. Only pages that let the user change the unit read it from the URL.
	const unitOfTime: moment.unitOfTime.Base = datePicker.isLockDatePicker
		? datePicker.unitOfTime
		: unit_of_time ?? datePicker.unitOfTime;

	// The date the range is anchored on — the one carried in the URL, or today.
	const anchor = date ? moment(date) : moment();

	// A locked picker always holds exactly one whole unit, so both ends are derived from the anchor.
	// `date_end` is deliberately ignored: carried over from a week page it stretched a day page's
	// range across seven days, and the arrows then stepped a week at a time (the `isCustomDate`
	// branch of the arrow strategies measures the span of the range itself).
	if (datePicker.isLockDatePicker) {
		return of({
			startDate: anchor.clone().startOf(unitOfTime).toDate(),
			endDate: anchor.clone().endOf(unitOfTime).toDate(),
			isCustomDate: false,
			unitOfTime
		});
	}

	// Calculate the start date based on the route query parameter or the current date
	const startDate = date ? anchor.clone().startOf('day') : anchor.clone().startOf(unitOfTime);

	// Calculate the end date based on the route query parameter or the start date
	const endDate = date_end ? moment(date_end).endOf('day') : moment(startDate).endOf(unitOfTime);

	// Determine if a custom date range is being used. The picker writes `date_end` on EVERY range
	// it stores, predefined ones included, so the flag itself is the only reliable signal here.
	const isCustomDate = parseToBoolean(is_custom_date);

	// Return an observable emitting the resolved date range picker configuration
	return of({ startDate: startDate.toDate(), endDate: endDate.toDate(), isCustomDate, unitOfTime });
};
