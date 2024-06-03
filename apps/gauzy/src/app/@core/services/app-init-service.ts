import { Injectable } from '@angular/core';
import { IUser } from '@gauzy/contracts';
import { Router } from '@angular/router';
import { NgxPermissionsService } from 'ngx-permissions';
import { UsersService } from '@gauzy/ui-sdk/core';
import { AuthStrategy } from '../../@core/auth/auth-strategy.service';
import { Store } from '@gauzy/ui-sdk/common';

@Injectable({ providedIn: 'root' })
export class AppInitService {
	user: IUser;

	constructor(
		private readonly usersService: UsersService,
		private readonly authStrategy: AuthStrategy,
		private readonly router: Router,
		private readonly store: Store,
		private readonly ngxPermissionsService: NgxPermissionsService
	) {}

	async init() {
		try {
			const id = this.store.userId;
			if (id) {
				this.user = await this.usersService.getMe(
					[
						'role',
						'role.rolePermissions',
						'tenant',
						'tenant.featureOrganizations',
						'tenant.featureOrganizations.feature'
					],
					true
				);

				this.authStrategy.electronAuthentication({
					user: this.user,
					token: this.store.token
				});

				//When a new user registers & logs in for the first time, he/she does not have tenantId.
				//In this case, we have to redirect the user to the onboarding page to create their first organization, tenant, role.
				if (!this.user?.tenantId) {
					this.router.navigate(['/onboarding/tenant']);
					return;
				}

				this.store.user = this.user;

				//tenant enabled/disabled features for relatives organizations
				const { tenant } = this.user;
				this.store.featureTenant = tenant.featureOrganizations.filter((item) => !item.organizationId);

				//only enabled permissions assign to logged in user
				this.store.userRolePermissions = this.user.role.rolePermissions.filter(
					(permission) => permission.enabled
				);

				const permissions = this.store.userRolePermissions.map(({ permission }) => permission);
				this.ngxPermissionsService.loadPermissions(permissions);
			}
		} catch (error) {
			console.log(error);
		}
	}
}
