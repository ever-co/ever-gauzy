import { Injectable } from '@angular/core';
import { IUser } from '@gauzy/contracts';
import { Router } from '@angular/router';
import { Store } from '../store/store.service';
import { PermissionsService } from '../permission/permissions.service';
import { UsersService } from '../users';
import { AuthStrategy } from '../auth/auth-strategy.service';
import { OrganizationContextService } from '../organization/organization-context.service';

@Injectable({ providedIn: 'root' })
export class AppInitService {
	user: IUser;

	constructor(
		private readonly _router: Router,
		private readonly _store: Store,
		private readonly _usersService: UsersService,
		private readonly _authStrategy: AuthStrategy,
		private readonly _permissionsService: PermissionsService,
		private readonly _organizationContextService: OrganizationContextService
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

				// Initialize organization context listener
				// This will refresh user.employee when the selected organization changes
				this._organizationContextService.initialize();
			}
		} catch (error) {
			console.log('Error on init', error);
		}
	}
}
