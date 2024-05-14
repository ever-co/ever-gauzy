import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve } from '@angular/router';
import { of } from 'rxjs';
import { Observable } from 'rxjs/internal/Observable';
import * as moment from 'moment';
import { IDateRangePicker } from '@gauzy/contracts';
import { IDatePickerConfig } from '@gauzy/ui-sdk/core';

@Injectable({
	providedIn: 'root'
})
export class DateRangePickerResolver implements Resolve<Observable<IDateRangePicker>> {
	/**
	 * Resolves the date range picker configuration based on the route parameters.
	 * @param route The activated route snapshot containing route information.
	 * @returns An observable of type `IDateRangePicker` representing the resolved date range picker configuration.
	 */
	resolve(route: ActivatedRouteSnapshot): Observable<IDateRangePicker> {
		// Extract the unitOfTime from route data
		const { unitOfTime } = route.data.datePicker as IDatePickerConfig;
		const { queryParams } = route;

		// Calculate the start date based on the route query parameter or the current date
		const startDate = queryParams.date ? moment(queryParams.date) : moment().startOf(unitOfTime); // Use current date if no query parameter is

		// Calculate the end date based on the route query parameter or the start date
		let endDate = queryParams.date_end ? moment(queryParams.date_end) : moment(startDate).endOf(unitOfTime); // Use start date if no end date query parameter is provided

		// Determine if it's a custom date range by checking the existence of the end date query parameter
		const isCustomDate = !!queryParams.date_end;

		// Return an observable emitting the resolved date range picker configuration
		return of({ startDate: startDate.toDate(), endDate: endDate.toDate(), isCustomDate });
	}
}
