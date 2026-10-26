import { inject } from '@angular/core';
import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { ActivatedRouteSnapshot, ResolveFn, Router } from '@angular/router';
import { catchError, Observable, of } from 'rxjs';
import { AuthService } from '@gauzy/ui-core/core';

/**
 * The outcome of `POST /auth/email/verify`, as the confirm-email page reads it.
 */
export interface IConfirmEmailOutcome {
	status: number;
	/** The API's own explanation of a refusal (e.g. an expired link), when it gave one. */
	message?: string;
}

/**
 * Resolves the email confirmation data.
 *
 * A refused confirmation resolves to its status and message rather than to null: the page filters
 * null out, so a rejected or expired link used to leave the spinner turning forever.
 *
 * @param route The activated route snapshot containing query parameters.
 * @returns An observable of the outcome, or null when the link is incomplete.
 */
export const ConfirmEmailResolver: ResolveFn<Observable<IConfirmEmailOutcome | null>> = (
	route: ActivatedRouteSnapshot
): Observable<IConfirmEmailOutcome | null> => {
	// Injecting the necessary services
	const service = inject(AuthService);
	const router = inject(Router);

	// Extracting email and token from query parameters
	const email = route.queryParamMap.get('email');
	const token = route.queryParamMap.get('token');

	// Check if both email and token are present
	if (!email || !token) {
		router.navigate(['/auth/login']);
		return of(null); // Return null if either parameter is missing
	}

	// Call the service to confirm the email with the token
	return (service.confirmEmail({ email, token }) as Observable<IConfirmEmailOutcome>).pipe(
		catchError((error: HttpErrorResponse) => {
			const message = error?.error?.message;
			return of({
				// 0 = no HTTP answer at all (offline, DNS, CORS); kept as 0 so the page can say "try again"
				// rather than "this link is not valid".
				status: typeof error?.status === 'number' ? error.status : HttpStatusCode.BadRequest,
				message: typeof message === 'string' ? message : undefined
			});
		})
	);
};
