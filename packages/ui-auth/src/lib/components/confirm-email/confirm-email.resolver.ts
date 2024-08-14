import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve, Router } from '@angular/router';
import { catchError, Observable, of } from 'rxjs';
import { IEstimateEmail } from '@gauzy/contracts';
import { AuthService } from '@gauzy/ui-core/core';

@Injectable({
	providedIn: 'root'
})
export class ConfirmEmailResolver implements Resolve<Observable<Object | Observable<never>>> {
	constructor(readonly authService: AuthService, readonly router: Router) {}

	/**
	 * Confirm the email.
	 *
	 * @param route - The route snapshot.
	 * @returns Observable of IEstimateEmail or an error.
	 */
	resolve(route: ActivatedRouteSnapshot): Observable<IEstimateEmail | never> {
		const email = route.queryParamMap.get('email');
		const token = route.queryParamMap.get('token');

		if (!email || !token) {
			console.log('Email or Token should not be blank');
			this.router.navigate(['/auth/login']);
			return of(); // Returning an empty observable as a fallback
		}

		return this.authService.confirmEmail({ email, token }).pipe(
			catchError((error) => {
				console.log('Handling error locally and rethrowing it...', error);
				return of(); // Returning an empty observable on error
			})
		);
	}
}
