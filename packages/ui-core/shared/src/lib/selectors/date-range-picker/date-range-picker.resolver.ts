import { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { Observable, of } from 'rxjs';
import moment from 'moment';
import { IDateRangePicker } from '@gauzy/contracts';
import { parseToBoolean } from '@gauzy/ui-core/common';
// TYPE-ONLY on purpose: a value import from the core barrel pulls the whole app graph
// (store -> @datorama/akita) into every route resolution and into this file's unit test.
import type { IDatePickerConfig } from '@gauzy/ui-core/core';

/**
 * Mirrors `DEFAULT_DATE_PICKER_CONFIG.unitOfTime`, kept local for the reason above. It is only
 * reached by a route that resolves dates without declaring a `datePicker` at all — reading
 * `.unitOfTime` off that missing config used to throw.
 */
const FALLBACK_UNIT_OF_TIME: moment.unitOfTime.Base = 'week';

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
	const { date, date_end, unit_of_time, is_custom_date } = route.queryParams;

	// The route's own picker configuration. Routes that declare no `datePicker` fall back to the
	// defaults instead of throwing on a missing `unitOfTime`.
	const datePicker = (route.data?.datePicker ?? {}) as Partial<IDatePickerConfig>;
	const isLockDatePicker = datePicker.isLockDatePicker ?? false;
	const routeUnitOfTime = datePicker.unitOfTime ?? FALLBACK_UNIT_OF_TIME;

	// `isLockDatePicker` means the page only works at ONE granularity: a day page (Time & Activity,
	// Screenshots, Videos, Apps, Visited Sites, Daily timesheet) shows the activity of a single date,
	// a weekly page a whole week. The user cannot change that unit there — `createDateRangeMenus`
	// offers only this unit — so a `unit_of_time` left in the URL by a PREVIOUS page must never win.
	// It used to: navigating from any week page landed on Time & Activity with 'week' selected while
	// the input still showed one date. Only pages that let the user change the unit read it from the URL.
	const unitOfTime: moment.unitOfTime.Base = isLockDatePicker ? routeUnitOfTime : unit_of_time ?? routeUnitOfTime;

	// The date the range is anchored on — the one carried in the URL, or today.
	const anchor = date ? moment(date) : moment();

	// A locked picker always holds exactly one whole unit, so both ends are derived from the anchor.
	// `date_end` is deliberately ignored: carried over from a week page it stretched a day page's
	// range across seven days, and the arrows then stepped a week at a time (the `isCustomDate`
	// branch of the arrow strategies measures the span of the range itself).
	if (isLockDatePicker) {
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

	// `is_custom_date` is authoritative WHEN PRESENT: the picker writes it alongside every
	// `date_end` it stores, predefined ranges included, so letting a bare `date_end` override it
	// would mark every reloaded week or month custom and make the arrows step by the span.
	//
	// When the flag is ABSENT the link came from somewhere else — the dashboard widgets and the
	// time-tracking page deep-link into the manual-time and apps-urls reports with only `date` and
	// `date_end` — and there an explicit end date is the one signal that the span belongs to the
	// caller rather than to the route's unit, which is what the arrows need in order to step by
	// that span instead of a whole week.
	const isCustomDate = is_custom_date !== undefined ? parseToBoolean(is_custom_date) : !!date_end;

	// Return an observable emitting the resolved date range picker configuration
	return of({ startDate: startDate.toDate(), endDate: endDate.toDate(), isCustomDate, unitOfTime });
};
