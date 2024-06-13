import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve } from '@angular/router';
import { catchError, debounceTime, map, of } from 'rxjs';
import { Observable } from 'rxjs/internal/Observable';
import { IOrganization } from '@gauzy/contracts';
import { OrganizationsService } from '../services';

@Injectable({
	providedIn: 'root'
})
export class EmployeeCountResolver implements Resolve<Observable<number | Observable<never>>> {
	constructor(private readonly _organizationsService: OrganizationsService) {}

	/**
	 * Resolves the employee count for the given route.
	 * @param route The activated route snapshot.
	 * @returns An observable of the employee count or 0 in case of an error or missing organization ID.
	 */
	resolve(route: ActivatedRouteSnapshot): Observable<number> {
		const organizationId = route.params['id'];
		if (!organizationId) {
			return of(0);
		}

		return this._organizationsService
			.getById(organizationId, [], {
				id: true,
				totalEmployees: true
			})
			.pipe(
				debounceTime(100),
				map((organization: IOrganization) => organization?.totalEmployees ?? 0),
				catchError(() => of(0)) // Return 0 on error
			);
	}
}
