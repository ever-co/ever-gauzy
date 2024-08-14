import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve } from '@angular/router';
import { catchError, Observable, of } from 'rxjs';
import { IEstimateEmail } from '@gauzy/contracts';
import { EstimateEmailService } from '@gauzy/ui-core/core';

@Injectable({
	providedIn: 'root'
})
export class EstimateEmailResolver implements Resolve<Observable<IEstimateEmail | Observable<never>>> {
	constructor(private readonly estimateEmailService: EstimateEmailService) {}

	/**
	 * Validate the estimate email using the provided token and email in the query params.
	 *
	 * @param route - The current route snapshot.
	 * @returns Observable with IEstimateEmail on success or an empty observable on error.
	 */
	resolve(route: ActivatedRouteSnapshot): Observable<IEstimateEmail | never> {
		const token = route.queryParamMap.get('token');
		const email = route.queryParamMap.get('email');

		if (!email || !token) {
			console.error('Email or Token should not be blank');
			return of(); // Return an empty observable if parameters are missing
		}

		return this.estimateEmailService.validate({ email, token }).pipe(
			catchError((error) => {
				console.error('Error occurred while validating estimate email', error);
				return of(); // Return an empty observable on error
			})
		);
	}
}
