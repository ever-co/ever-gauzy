import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn, Router } from '@angular/router';
import { catchError, Observable, of } from 'rxjs';
import { IEstimateEmail } from '@gauzy/contracts';
import { AuthService } from '@gauzy/ui-core/core';

/**
 * Resolves the email confirmation data.
 *
 * @param route The activated route snapshot containing query parameters.
 * @returns An observable of IEstimateEmail or null.
 */
export const ConfirmEmailResolver: ResolveFn<Observable<IEstimateEmail | null>> = (
	route: ActivatedRouteSnapshot
): Observable<IEstimateEmail | null> => {
	// Injecting the necessary services
	const service = inject(AuthService);
	const router = inject(Router);

	// Extracting email and token from query parameters
	const email = route.queryParamMap.get('email');
	const token = route.queryParamMap.get('token');

	// Check if both email and token are present
	if (!email || !token) {
		console.log('Email or Token should not be blank');
		router.navigate(['/auth/login']);
		return of(null); // Return null if either parameter is missing
	}

	// Call the service to confirm the email with the token
	return service.confirmEmail({ email, token }).pipe(
		catchError((error) => {
			console.log('Handling error locally and rethrowing it...', error);
			return of(null); // Return null on error
		})
	);
};
