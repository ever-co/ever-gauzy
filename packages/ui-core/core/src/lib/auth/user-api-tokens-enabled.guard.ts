import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { UserApiTokenService } from '../services/user-api-token/user-api-token.service';

/**
 * Opens the API tokens page only while the server has API tokens on (`GAUZY_USER_API_TOKENS_ENABLED`); otherwise sends
 * the visitor to the Settings pages. The routes behind the page answer 404 on such a server anyway.
 */
export const userApiTokensEnabledGuard: CanActivateFn = () => {
	const router = inject(Router);
	return inject(UserApiTokenService).enabled$.pipe(
		map((enabled) => enabled || router.createUrlTree(['/pages/settings']))
	);
};
