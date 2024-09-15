import { inject } from '@angular/core';
import { ResolveFn, Router } from '@angular/router';
import { Observable, catchError, debounceTime, from, of, tap } from 'rxjs';
import { IUser } from '@gauzy/contracts';
import { ErrorHandlingService, UsersService } from '../services';

/**
 * Resolves the current user data and handles navigation based on the user's tenant status.
 *
 * @returns An observable of the user ID or an observable of error in case of failure.
 */
export const UserResolver: ResolveFn<Observable<IUser | null>> = (): Observable<IUser | null> => {
	const _router = inject(Router);
	const _usersService = inject(UsersService);
	const _errorHandlingService = inject(ErrorHandlingService);

	// Fetch user data
	const user$ = from(_usersService.getMe());

	// Fetch user data from the service
	return user$.pipe(
		// Debounce the request to avoid excessive API calls
		debounceTime(100),
		// Check if the user has a tenant ID
		tap((user: IUser) => {
			if (!user.tenantId) {
				_router.navigate(['/onboarding/tenant']);
				return;
			}
		}),
		// Handle errors
		catchError((error) => {
			// Handle and log errors using the _errorHandlingService
			_errorHandlingService.handleError(error);
			// Return null to indicate an error
			return of(null);
		})
	);
};
