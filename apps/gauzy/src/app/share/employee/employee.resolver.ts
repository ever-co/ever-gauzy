import { Injectable } from '@angular/core';
import {
	Resolve,
	Router,
	RouterStateSnapshot,
	ActivatedRouteSnapshot
} from '@angular/router';
import { EmployeesService } from '../../@core/services';
import { ErrorHandlingService } from '../../@core/services/error-handling.service';

@Injectable({
	providedIn: 'root'
})
export class EmployeeResolver implements Resolve<any> {
	constructor(
		private employeesService: EmployeesService,
		private router: Router,
		private errorHandlingService: ErrorHandlingService
	) {}

	async resolve(
		route: ActivatedRouteSnapshot,
		state: RouterStateSnapshot
	): Promise<any> {
		try {
			return await this.employeesService.getEmployeeById(
				route.params.employeeId,
				['user', 'organization']
			);
		} catch (e) {
			this.errorHandlingService.handleError(e);
			this.router.navigateByUrl('/');
		}
	}
}
