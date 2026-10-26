import { inject } from '@angular/core';
import { ResolveFn, Router } from '@angular/router';
import { Observable, from, map, catchError, of } from 'rxjs';
import { IUser } from '@gauzy/contracts';
import { UsersService, ErrorHandlingService } from '../services';

/**
 * Retrieves the user data and performs onboarding-related navigation.
 *
 * @returns Observable<IUser | null> - An observable that emits the user data or null in case of an error.
 */
export const OnboardingResolver: ResolveFn<Observable<IUser | null>> = (): Observable<IUser | null> => {
	// Inject the necessary services
	const _router = inject(Router);
	const _usersService = inject(UsersService);
	const _errorHandlingService = inject(ErrorHandlingService);

	// Fetch the user data, with the organizations they belong to
	const user$ = _usersService.getMe(['organizations']);

	// Fetch the user data from the service
	return from(user$).pipe(
		map((user: IUser) => {
			// Only a user who already has an organization is done with onboarding. One who has a tenant
			// but no organization yet (e.g. the super admin created with the default tenant on a fresh
			// install) stays on the form, which then creates the organization in that tenant.
			if (user.tenantId && user.organizations?.length) {
				_router.navigate(['/onboarding/complete']);
			}
			return user;
		}),
		// Handle any errors
		catchError((error) => {
			// Handle and log any errors
			_errorHandlingService.handleError(error);
			// Return null to indicate an error
			return of(null);
		})
	);
};
