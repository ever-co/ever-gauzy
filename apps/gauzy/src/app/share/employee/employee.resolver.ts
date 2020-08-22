import { Injectable } from '@angular/core';
import {
	Resolve,
	Router,
	RouterStateSnapshot,
	ActivatedRouteSnapshot
} from '@angular/router';
import { EmployeesService } from '../../@core/services';
import { ErrorHandlingService } from '../../@core/services/error-handling.service';
import { catchError } from 'rxjs/operators';
import { EMPTY, Observable } from 'rxjs';
import { Employee } from '@gauzy/models';

@Injectable({
	providedIn: 'root'
})
export class EmployeeResolver implements Resolve<any> {
	constructor(
		private employeesService: EmployeesService,
		private router: Router,
		private errorHandlingService: ErrorHandlingService
	) {}

	resolve(
		route: ActivatedRouteSnapshot,
		state: RouterStateSnapshot
	): Observable<Employee> {
		return this.employeesService
			.getPublicById(route.params.employeeId, [
				'user',
				'organization',
				'organizationEmploymentTypes',
				'tags',
				'skills'
			])
			.pipe(
				catchError((e) => {
					this.errorHandlingService.handleError(e);
					this.router.navigateByUrl('/');
					return EMPTY;
				})
			);
	}
}
