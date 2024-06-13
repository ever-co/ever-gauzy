import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve } from '@angular/router';
import { of } from 'rxjs';
import { Observable } from 'rxjs/internal/Observable';
import moment from 'moment';
import { IDatePickerConfig } from '@gauzy/ui-core/core';
import { parseToBoolean } from '@gauzy/ui-core/common';
import { IDateRangePicker } from '@gauzy/contracts';

@Injectable({
	providedIn: 'root'
})
export class DateRangePickerResolver implements Resolve<Observable<IDateRangePicker>> {
	/**
	 * Resolves the date range picker configuration based on the route parameters.
	 *
	 * @param route The activated route snapshot containing route information.
	 * @returns An observable of type `IDateRangePicker` representing the resolved date range picker configuration.
	 */
	resolve(route: ActivatedRouteSnapshot): Observable<IDateRangePicker> {
		const { queryParams } = route;
		const { date, date_end, unit_of_time, is_custom_date = false } = queryParams;

		// Extract the unitOfTime from query parameters or route data
		const unitOfTime = unit_of_time ?? (route.data.datePicker as IDatePickerConfig).unitOfTime;

		// Calculate the start date based on the route query parameter or the current date
		const startDate = date ? moment(date).startOf('day') : moment().startOf(unitOfTime); // Use current date if no query parameter is

		// Calculate the end date based on the route query parameter or the start date
		let endDate = date_end ? moment(date_end).endOf('day') : moment(startDate).endOf(unitOfTime); // Use start date if no end date query parameter is provided

		// Determine if a custom date range is being used
		const isCustomDate = parseToBoolean(is_custom_date) ?? !!date_end;

		// Return an observable emitting the resolved date range picker configuration
		return of({ startDate: startDate.toDate(), endDate: endDate.toDate(), isCustomDate, unitOfTime });
	}
}
