import { inject } from '@angular/core';
import { ResolveFn, ActivatedRouteSnapshot } from '@angular/router';
import { catchError, Observable, of } from 'rxjs';
import { ITimesheet } from '@gauzy/contracts';
import { TimesheetService } from '@gauzy/ui-core/core';

/**
 * Resolves a timesheet by its ID from the route parameters.
 *
 * @param route - The active route snapshot containing the timesheet ID.
 * @returns An observable of the resolved timesheet or null if not found or an error occurs.
 */
export const TimesheetResolver: ResolveFn<Observable<ITimesheet | null>> = (
	route: ActivatedRouteSnapshot
): Observable<ITimesheet | null> => {
	// Inject the necessary services
	const _timesheetService = inject(TimesheetService);

	// Get the timesheet ID from the route parameters
	const timesheetId = route.paramMap.get('id');

	// If no ID is found in the route parameters, return an empty observable
	if (!timesheetId) {
		// If no ID is found in the route parameters, return an empty observable
		return of(null);
	}

	// Get the timesheet from the service
	return _timesheetService.getTimeSheetById(timesheetId).pipe(
		catchError((error) => {
			// Log the error or handle it as needed
			console.error('Error fetching timesheet:', error);
			// Return null in case of an error
			return of(null);
		})
	);
};
