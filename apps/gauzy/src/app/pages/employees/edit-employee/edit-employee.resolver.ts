import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve, Router } from '@angular/router';
import { catchError, Observable, of } from 'rxjs';
import { IEmployee } from '@gauzy/contracts';
import { EmployeesService } from '@gauzy/ui-core/core';

@Injectable({
	providedIn: 'root'
})
export class EditEmployeeResolver implements Resolve<Observable<IEmployee>> {
	constructor(private readonly employeeService: EmployeesService, private readonly router: Router) {}

	/**
	 * Resolve method for fetching employee data by ID.
	 *
	 * @param route - The activated route snapshot containing route parameters.
	 * @returns An observable of type IEmployee, representing the resolved employee data.
	 */
	resolve(route: ActivatedRouteSnapshot): Observable<IEmployee> {
		try {
			const employeeId = route.params.id; // Extract employee ID from route parameters
			const relations = ['user', 'user.image', 'organizationPosition']; // Define relations to include in the query

			if (!employeeId) {
				of(null);
			}

			// Call the employeeService to fetch employee data by ID with specified relations
			return this.employeeService.getEmployeeById(employeeId, relations).pipe(
				catchError((error) => {
					// Handle errors and return as observable of the error
					return of(error);
				})
			);
		} catch (error) {
			// Catch any synchronous errors and navigate to the employee listing page
			this.router.navigate(['/pages/employees']);
		}
	}
}
