import { Injectable } from '@angular/core';
import { Resolve, Router } from '@angular/router';
import { catchError, debounceTime, from, of, tap } from 'rxjs';
import { Observable } from 'rxjs/internal/Observable';
import { IUser } from '@gauzy/contracts';
import { ErrorHandlingService, UsersService } from '../services';

@Injectable({
	providedIn: 'root'
})
export class UserResolver implements Resolve<Observable<number | Observable<never>>> {
	constructor(
		private readonly _router: Router,
		private readonly _usersService: UsersService,
		private readonly _errorHandlingService: ErrorHandlingService
	) {}

	// Get the observable for fetching user data from the service
	resolve(): Observable<number> {
		// Get the observable for fetching user data from the service
		const user$ = this._usersService.getMe();

		// Pipe operators to process the observable stream
		return from(user$).pipe(
			debounceTime(100), // Add a debounceTime to wait for a specified time before emitting the latest value
			tap((user: IUser) => {
				//When a new user registers & logs in for the first time, he/she does not have tenantId.
				//In this case, we have to redirect the user to the onboarding page to create their first organization, tenant, role.
				if (!user.tenantId) {
					this._router.navigate(['/onboarding/tenant']);
					return;
				}
			}),
			// Catch and handle errors
			catchError((error) => {
				// Handle and log errors using the _errorHandlingService
				this._errorHandlingService.handleError(error);
				// Return an empty observable to continue the stream
				return of(error);
			})
		);
	}
}
