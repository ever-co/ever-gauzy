import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve } from '@angular/router';
import { catchError, debounceTime, of } from 'rxjs';
import { Observable } from 'rxjs/internal/Observable';
import { EmployeesService, Store } from '../services';

@Injectable({
	providedIn: 'root'
})
export class EmployeeCountResolver implements Resolve<Observable<number | Observable<never>>> {
	constructor(private readonly employeesService: EmployeesService, private readonly store: Store) {}

	/**
	 * Resolves the employee count for the given route.
	 * @param route The activated route snapshot.
	 * @returns An observable of the employee count or an error code.
	 */
	resolve(route: ActivatedRouteSnapshot): Observable<number> {
		const organizationId = route.params['id'];
		const { tenantId } = this.store.user;

		if (!organizationId || !tenantId) {
			return of(0);
		}

		return this.employeesService.getCount({ tenantId, organizationId }).pipe(
			debounceTime(100),
			catchError(() => of(0)) // Return 0 on error
		);
	}
}
