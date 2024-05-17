import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve } from '@angular/router';
import { catchError, debounceTime, of } from 'rxjs';
import { Observable } from 'rxjs/internal/Observable';
import { isEmpty } from '@gauzy/ui-sdk/common';
import { EmployeesService, Store } from '../services';

@Injectable({
	providedIn: 'root'
})
export class EmployeeCountResolver implements Resolve<Observable<number | Observable<never>>> {
	constructor(private readonly employeesService: EmployeesService, private readonly store: Store) {}

	resolve(route: ActivatedRouteSnapshot): Observable<number> {
		const organizationId = route.params.id;
		const { tenantId } = this.store.user;

		if (isEmpty(organizationId) || isEmpty(tenantId)) of(0);

		return this.employeesService
			.getCount({
				tenantId,
				organizationId
			})
			.pipe(
				debounceTime(100),
				catchError((error) => of(error))
			);
	}
}
