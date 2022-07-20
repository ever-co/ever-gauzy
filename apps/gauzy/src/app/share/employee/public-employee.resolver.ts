import { Injectable } from '@angular/core';
import {
	Resolve,
	Router,
	ActivatedRouteSnapshot
} from '@angular/router';
import { EmployeesService } from '../../@core/services';
import { ErrorHandlingService } from '../../@core/services/error-handling.service';
import { catchError } from 'rxjs/operators';
import { EMPTY, Observable } from 'rxjs';
import { IEmployee } from '@gauzy/contracts';

@Injectable({
	providedIn: 'root'
})
export class PublicEmployeeResolver implements Resolve<any> {
	constructor(
		private readonly employeesService: EmployeesService,
		private readonly router: Router,
		private readonly errorHandlingService: ErrorHandlingService
	) {}

	resolve(
		route: ActivatedRouteSnapshot
	): Observable<IEmployee> {
		const slug = route.params.slug;
		const employeeId = route.params.employeeId;
		try {
			return this.employeesService.getPublicById(slug, employeeId, [
				'user',
				'organizationEmploymentTypes',
				'skills'
			])
			.pipe(
				catchError((e) => {
					this.errorHandlingService.handleError(e);
					this.router.navigateByUrl('/');
					return EMPTY;
				})
			);
        } catch (error) {
            this.router.navigateByUrl('/');
        }
	}
}
