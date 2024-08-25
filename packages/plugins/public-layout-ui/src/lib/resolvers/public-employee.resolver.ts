import { Injectable } from '@angular/core';
import { Resolve, Router, ActivatedRouteSnapshot } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { EMPTY, Observable } from 'rxjs';
import { IEmployee } from '@gauzy/contracts';
import { EmployeesService, ErrorHandlingService } from '@gauzy/ui-core/core';

@Injectable({
	providedIn: 'root'
})
export class PublicEmployeeResolver implements Resolve<any> {
	constructor(
		private readonly _employeesService: EmployeesService,
		private readonly _router: Router,
		private readonly _errorHandlingService: ErrorHandlingService
	) {}

	/**
	 * Resolves the public employee data based on the provided route parameters.
	 *
	 * @param route ActivatedRouteSnapshot containing route parameters.
	 * @returns Observable<IEmployee> resolving the employee data.
	 */
	resolve(route: ActivatedRouteSnapshot): Observable<IEmployee> {
		// Extracting route parameters
		const { slug, employeeId } = route.params;

		// Relations to be included in the response
		const relations = ['user', 'organizationEmploymentTypes', 'skills', 'awards'];

		// Fetching the public employee data
		return this._employeesService.getPublicById(slug, employeeId, relations).pipe(
			catchError((error) => {
				this._errorHandlingService.handleError(error);
				this._router.navigateByUrl('/');
				return EMPTY;
			})
		);
	}
}
