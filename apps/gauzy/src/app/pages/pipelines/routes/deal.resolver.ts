import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve } from '@angular/router';
import { catchError, from, of } from 'rxjs';
import { Observable } from 'rxjs/internal/Observable';
import { IDeal } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/common';
import { DealsService, ErrorHandlingService } from '@gauzy/ui-core/core';

@Injectable()
export class DealResolver implements Resolve<Observable<IDeal | Observable<never>>> {
	constructor(
		private readonly _store: Store,
		private readonly _dealsService: DealsService,
		private readonly _errorHandlingService: ErrorHandlingService
	) {}

	/**
	 * Resolve method to fetch a deal by its ID.
	 *
	 * @param route The activated route snapshot containing the route parameters.
	 * @returns An observable of IDeal or null if no dealId is present.
	 */
	resolve(route: ActivatedRouteSnapshot): Observable<IDeal> {
		const dealId = route.params['dealId'];
		if (!dealId) {
			return of(null);
		}

		const { id: organizationId, tenantId } = this._store.selectedOrganization;
		const api$ = this._dealsService.getById(dealId, { organizationId, tenantId }, ['client']);

		return from(api$).pipe(
			catchError((error) => {
				// Handle and log errors
				this._errorHandlingService.handleError(error);
				return of(error);
			})
		);
	}
}
