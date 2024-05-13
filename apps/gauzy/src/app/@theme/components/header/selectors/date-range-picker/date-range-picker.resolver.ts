import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve } from '@angular/router';
import { of } from 'rxjs';
import { Observable } from 'rxjs/internal/Observable';
import * as moment from 'moment';
import { IDateRangePicker } from '@gauzy/contracts';
import { IDatePickerConfig } from '../../../../../@core/services/selector-builder/selector-builder-types';

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

		// Calculate the start date based on the route query parameter or the current date
		const startDate = moment(route.queryParams.date || new Date()).startOf(unitOfTime);

		// Calculate the end date based on the route query parameter or the start date
		const endDate = moment(route.queryParams.date_end || startDate).endOf(unitOfTime);

		// Determine if it's a custom date range by checking the existence of the end date query parameter
		const isCustomDate = !!route.queryParams.date_end;

		console.log({ startDate: startDate.toDate(), endDate: endDate.toDate(), isCustomDate });

		// Return an observable emitting the resolved date range picker configuration
		return of({ startDate: startDate.toDate(), endDate: endDate.toDate(), isCustomDate });
	}
}
