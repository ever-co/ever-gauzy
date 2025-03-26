import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Router } from '@angular/router';
import { AppService } from '../services';
import { IAppConfig } from '@gauzy/contracts';
import { firstValueFrom, map } from 'rxjs';

/**
 * Use for routes which can't be accessed if email/password authentication is disabled
 */
@Injectable()
export class NoEmailPasswordGuard {
	constructor(
		private readonly _router: Router,
		private readonly appService: AppService,
	) { }

	/**
	 * Checks if the email/password authentication is enabled
	 *
	 * @param {ActivatedRouteSnapshot} route - The route to navigate to.
	 * @return {Promise<boolean>} A promise that resolves to true if the email/password authentication is enabled, false otherwise.
	 */
	async canActivate(route: ActivatedRouteSnapshot): Promise<boolean> {
		// Call to get if email/password login is enabled
		const emailPasswordLoginEnabled = await firstValueFrom(
			this.appService.getAppConfigs().pipe(
				map((configs: IAppConfig) => configs.email_password_login)
			)
		);

		if (!emailPasswordLoginEnabled) {
			// Email/password login is disabled, redirect to dashboard
			// Preserve any query params when redirecting
			const queryParams = route.queryParams;
			this._router.navigate(['/auth/login'], { queryParams });
			return false;
		}

		return true;
	}
}
