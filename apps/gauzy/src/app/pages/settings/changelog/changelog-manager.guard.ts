import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { RolesEnum } from '@gauzy/contracts';
import { AuthService } from '@gauzy/ui-core/core';

/** Where anyone who may not manage the What's New entries lands instead. */
export const CHANGELOG_MANAGER_FALLBACK_URL = '/pages/settings';

/**
 * Whether the signed-in user may open the What's New management page: only a super admin may, since the API
 * takes changes from no one else. The role is asked of the API, not read from the cached user, and a failed
 * check keeps the page closed. (The API can still refuse a super admin who is not the installation's
 * operator; the page says so then.) Runs in an injection context.
 *
 * @returns `true`, or where to send the user instead.
 */
export async function canManageChangelog(): Promise<boolean | UrlTree> {
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
}

/** The What's New management route's guard; see {@link canManageChangelog}. */
export const changelogManagerGuard: CanActivateFn = () => canManageChangelog();
