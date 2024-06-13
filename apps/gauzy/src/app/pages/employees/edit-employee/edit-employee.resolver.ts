import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve, Router } from '@angular/router';
import { catchError, Observable, of as observableOf } from 'rxjs';
import { IEmployee } from '@gauzy/contracts';
import { EmployeesService } from '@gauzy/ui-core/core';

@Injectable({
	providedIn: 'root'
})
export class EditEmployeeResolver implements Resolve<Observable<IEmployee>> {
	constructor(private readonly employeeService: EmployeesService, private readonly router: Router) {}

	resolve(route: ActivatedRouteSnapshot): Observable<IEmployee> {
		try {
			const employeeId = route.params.id;
			return this.employeeService.getEmployeeById(employeeId, ['user', 'organizationPosition']).pipe(
				catchError((error) => {
					return observableOf(error);
				})
			);
		} catch (error) {
			this.router.navigate(['/pages/employees']);
		}
	}
}
