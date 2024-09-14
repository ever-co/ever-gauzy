import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { catchError, Observable, of } from 'rxjs';
import { IEstimateEmail } from '@gauzy/contracts';
import { EstimateEmailService } from '@gauzy/ui-core/core';

/**
 * Resolver function for validating an estimate email based on query parameters.
 *
 * @param route - The ActivatedRouteSnapshot containing route and query parameters.
 * @returns An Observable that emits an IEstimateEmail if validation is successful,
 *          or an empty Observable if parameters are missing or an error occurs.
 */
export const EstimateEmailResolver: ResolveFn<Observable<IEstimateEmail | never>> = (
	route: ActivatedRouteSnapshot
): Observable<IEstimateEmail | never> => {
	// Injecting the EstimateEmailService
	const service = inject(EstimateEmailService);

	// Extracting 'token' and 'email' from query parameters
	const token = route.queryParamMap.get('token');
	const email = route.queryParamMap.get('email');

	// Check if both 'email' and 'token' are present
	if (!email || !token) {
		console.error('Email or Token should not be blank');
		return of(); // Return an empty Observable if parameters are missing
	}

	// Validate the email with the token using the service
	return service.validate({ email, token }).pipe(
		catchError((error) => {
			console.error('Error occurred while validating estimate email', error);
			return of(); // Return an empty Observable on error
		})
	);
};
