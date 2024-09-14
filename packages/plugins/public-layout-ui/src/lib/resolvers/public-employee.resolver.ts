import { inject } from '@angular/core';
import { ResolveFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { catchError, EMPTY, Observable } from 'rxjs';
import { IEmployee } from '@gauzy/contracts';
import { EmployeesService, ErrorHandlingService } from '@gauzy/ui-core/core';

/**
 * Resolves the public employee data based on the provided route parameters.
 *
 * This resolver function retrieves employee data by calling the EmployeesService
 * and handles errors by navigating to the homepage and logging the error using
 * ErrorHandlingService. If an error occurs, it returns an empty observable.
 *
 * @param route - The ActivatedRouteSnapshot containing route parameters including
 *                the employee ID and slug used to fetch employee data.
 * @returns An observable of the public employee data.
 */
export const PublicEmployeeResolver: ResolveFn<Observable<IEmployee>> = (
	route: ActivatedRouteSnapshot
): Observable<IEmployee> => {
	const _router = inject(Router);
	const _employeesService = inject(EmployeesService);
	const _errorHandlingService = inject(ErrorHandlingService);

	// Extracting route parameters
	const { slug, employeeId } = route.params;

	if (!employeeId || !slug) {
		// Returning an empty observable if employeeId is not provided
		return EMPTY;
	}

	// Relations to be included in the response
	const relations = ['user', 'organizationEmploymentTypes', 'skills', 'awards'];

	// Fetching the public employee data
	return _employeesService.getPublicById(slug, employeeId, relations).pipe(
		catchError((error) => {
			// Logging the error
			_errorHandlingService.handleError(error);
			// Navigating to the homepage
			_router.navigateByUrl('/');
			// Returning an empty observable to prevent further actions
			return EMPTY;
		})
	);
};
