import { Injectable } from '@angular/core';
import { Resolve, Router } from '@angular/router';
import { catchError, from, map, of } from 'rxjs';
import { Observable } from 'rxjs/internal/Observable';
import { IUser } from '@gauzy/contracts';
import { ErrorHandlingService, UsersService } from '../services';

@Injectable({
	providedIn: 'root'
})
export class OnboardingResolver implements Resolve<Observable<IUser | Observable<never>>> {
	constructor(
		private readonly _router: Router,
		private readonly _usersService: UsersService,
		private readonly _errorHandlingService: ErrorHandlingService
	) {}

	// Get the observable for fetching user data from the service
	resolve(): Observable<IUser> {
		// Pipe operators to process the observable stream
		return from(this._usersService.getMe()).pipe(
			map((user: IUser) => {
				if (user.tenantId) {
					this._router.navigate(['/onboarding/complete']);
					return user; // User has a tenantId
				}
				return user; // Return the user object
			}),
			// Catch and handle errors
			catchError((error) => {
				// Handle and log errors using the _errorHandlingService
				this._errorHandlingService.handleError(error);
				// Error occurred, return false or handle as needed
				return of(null);
			})
		);
	}
}
