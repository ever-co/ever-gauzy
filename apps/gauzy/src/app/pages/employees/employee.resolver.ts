import { ActivatedRouteSnapshot, ResolveFn, Router } from '@angular/router';
import { Observable, catchError, of } from 'rxjs';
import { IEmployee } from '@gauzy/contracts';
import { inject } from '@angular/core';
import { EmployeesService } from '@gauzy/ui-core/core';

/**
 * Builds a resolver that fetches an employee by route id with the given relations.
 *
 * The read-only View and the edit page want different relation sets — the View
 * shows the whole profile in one pass, the edit page loads per tab — so the
 * relation list is the only thing that varies between them.
 *
 * @param relations - Relations to eager-load with the employee.
 */
const resolveEmployeeWith =
	(relations: string[]): ResolveFn<Observable<IEmployee | null>> =>
	(route: ActivatedRouteSnapshot): Observable<IEmployee | null> => {
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
			return _employeeService.getEmployeeById(employeeId, relations).pipe(
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

/**
 * Resolver function for fetching employee data by ID.
 *
 * @param route - The activated route snapshot containing route parameters.
 * @returns An observable of type IEmployee or `null` in case of an error.
 */
export const EmployeeResolver: ResolveFn<Observable<IEmployee | null>> = resolveEmployeeWith([
	'user',
	'user.image',
	'organizationPosition'
]);

/**
 * Resolver for the read-only employee View, which renders the whole profile on
 * one page and therefore needs every relation it shows up front.
 */
export const EmployeeViewResolver: ResolveFn<Observable<IEmployee | null>> = resolveEmployeeWith([
	'user',
	'user.image',
	'organizationPosition',
	'organizationDepartments',
	'organizationEmploymentTypes',
	'tags',
	'skills',
	'contact'
]);
