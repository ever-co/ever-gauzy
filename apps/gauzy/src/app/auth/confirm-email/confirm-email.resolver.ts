import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve, Router } from '@angular/router';
import { catchError, Observable, of as observableOf } from 'rxjs';
import { IEstimateEmail } from '@gauzy/contracts';
import { AuthService } from '@gauzy/ui-core/core';

@Injectable({
	providedIn: 'root'
})
export class ConfirmEmailResolver implements Resolve<Observable<Object | Observable<never>>> {
	constructor(private readonly authService: AuthService, private readonly router: Router) {}

	resolve(route: ActivatedRouteSnapshot): Observable<IEstimateEmail | Observable<never>> {
		const email = route.queryParamMap.get('email');
		const token = route.queryParamMap.get('token');

		try {
			if (!email || !token) {
				throw new Error('Email or Token should not be blank');
			}
			return this.authService
				.confirmEmail({
					email,
					token
				})
				.pipe(
					catchError((error) => {
						console.log('Handling error locally and rethrowing it...', error);
						return observableOf(error);
					})
				);
		} catch (error) {
			console.log('Handling error while verify email address...', error.message);
			this.router.navigate(['/auth/login']);
		}
	}
}
