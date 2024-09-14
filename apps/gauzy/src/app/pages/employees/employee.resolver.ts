import { ActivatedRouteSnapshot, ResolveFn, Router } from '@angular/router';
import { Observable, catchError, of } from 'rxjs';
import { IEmployee } from '@gauzy/contracts';
import { inject } from '@angular/core';
import { EmployeesService } from '@gauzy/ui-core/core';

/**
 * Resolver function for fetching employee data by ID.
 *
 * @param route - The activated route snapshot containing route parameters.
 * @returns An observable of type IEmployee or `null` in case of an error.
 */
export const EmployeeResolver: ResolveFn<Observable<IEmployee | null>> = (
	route: ActivatedRouteSnapshot
): Observable<IEmployee | null> => {
	// Injecting the necessary services
	const _router = inject(Router);
	const _employeeService = inject(EmployeesService);

	try {
		// Extract employee ID from the route parameters
		const employeeId = route.paramMap.get('id');
		// Check if employee ID is present
		if (!employeeId) {
			// Return an observable emitting null if no employee ID is present
			return of(null);
		}

		// Fetch employee data by ID using the employee service
		return _employeeService.getEmployeeById(employeeId, ['user', 'user.image', 'organizationPosition']).pipe(
			catchError(() => {
				// Handle errors and navigate to employees page if an error occurs
				_router.navigate(['/pages/employees']);
				// Return an observable emitting null in case of an error
				return of(null);
			})
		);
	} catch (error) {
		// Handle synchronous errors by navigating to the employees page
		_router.navigate(['/pages/employees']);
		// Return an observable emitting null
		return of(null);
	}
};
