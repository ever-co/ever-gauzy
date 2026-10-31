import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { RolesEnum } from '@gauzy/contracts';
import { AuthService } from '@gauzy/ui-core/core';

/** Where anyone who may not manage the What's New entries lands instead. */
export const CHANGELOG_MANAGER_FALLBACK_URL = '/pages/settings';

/**
 * Lets only a super admin open the What's New management page: the API takes changes from no one else. The
 * role is asked of the API, not read from the cached user, and a failed check keeps the page closed. (The
 * API can still refuse a super admin who is not the installation's operator; the page says so then.)
 */
export const changelogManagerGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
	const router = inject(Router);
	const authService = inject(AuthService);
	try {
		if (await firstValueFrom(authService.hasRole([RolesEnum.SUPER_ADMIN]))) {
			return true;
		}
	} catch {
		// Fall through: an unanswered check is not a yes.
	}
	return router.parseUrl(CHANGELOG_MANAGER_FALLBACK_URL);
};
