import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-core/common';
import { IUser } from '@gauzy/contracts';
import { Router } from '@angular/router';
import { Store } from '../store/store.service';
import { PermissionsService } from '../permission/permissions.service';
import { UsersService } from '../users';
import { AuthStrategy } from '../auth/auth-strategy.service';

@Injectable({ providedIn: 'root' })
export class AppInitService {
	user: IUser;

	constructor(
		private readonly _router: Router,
		private readonly _store: Store,
		private readonly _usersService: UsersService,
		private readonly _authStrategy: AuthStrategy,
		private readonly _permissionsService: PermissionsService,
		private readonly _http: HttpClient
	) {}

	async init() {
		try {
			const id = this._store.userId;
			if (id) {
				const relations = [
					'role',
					'tenant',
					'tenant.featureOrganizations',
					'tenant.featureOrganizations.feature'
				];
				this.user = await this._usersService.getMe(relations, true);

				// Electron authentication
				this._authStrategy.electronAuthentication({
					user: this.user,
					token: this._store.token,
					refresh_token: this._store.refresh_token
				});

				//When a new user registers & logs in for the first time, he/she does not have tenantId.
				//In this case, we have to redirect the user to the onboarding page to create their first organization, tenant, role.
				if (!this.user?.tenantId) {
					this._router.navigate(['/onboarding/tenant']);
					return;
				}

				this._store.user = this.user;

				//Load permissions
				this._permissionsService.loadPermissions();

				//tenant enabled/disabled features for relatives organizations
				const { tenant } = this.user;
				this._store.featureTenant = tenant.featureOrganizations.filter((item) => !item.organizationId);

				// Whether this deployment does billing at all, resolved once here rather than by whatever
				// happens to need it. The sidebar reads it to decide whether a Billing entry exists at all:
				// a self-hosted install has no Stripe key, so offering a menu item that leads only to a
				// "not configured" card would be a visible change to people who never asked for billing.
				await this.loadBillingAvailability();
			}
		} catch (error) {
			console.log('Error on init', error);
		}
	}

	/**
	 * Ask the API whether billing exists here, and remember the answer.
	 *
	 * Deliberately swallows every failure and leaves the flag false. An older API has no such route,
	 * and a deployment that cannot answer is one that should not be showing billing UI anyway — so the
	 * safe default and the failure default are the same value.
	 */
	private async loadBillingAvailability(): Promise<void> {
		try {
			const config = await firstValueFrom(
				this._http.get<{ enabled: boolean }>(`${API_PREFIX}/billing/config`)
			);
			this._store.billingEnabled = Boolean(config?.enabled);
		} catch {
			this._store.billingEnabled = false;
		}
	}
}
