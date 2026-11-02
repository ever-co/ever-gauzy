import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { RegistrationConfigService } from '../services/auth/registration-config.service';

/**
 * Opens the register page only while the server accepts public sign-ups; otherwise sends the visitor to the sign-in
 * page, where invitations and existing accounts still work. A server that cannot say (an older API) keeps the page
 * open, as it has always been.
 */
export const registrationEnabledGuard: CanActivateFn = () => {
	const router = inject(Router);
	return inject(RegistrationConfigService).registrationEnabled$.pipe(
		map((enabled) => enabled || router.createUrlTree(['/auth/login']))
	);
};
