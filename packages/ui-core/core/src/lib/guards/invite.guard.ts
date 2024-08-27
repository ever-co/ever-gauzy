import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { IOrganization, PermissionsEnum } from '@gauzy/contracts';
import { Store } from '../services';

@Injectable()
export class InviteGuard implements CanActivate {
	hasPermission = false;
	organizationInvitesAllowed = false;

	constructor(private readonly router: Router, private readonly store: Store) {}

	/**
	 * Checks if the user has the required permissions and if invites are allowed for the selected organization.
	 *
	 * @param {ActivatedRouteSnapshot} route - The route snapshot containing the expected permissions.
	 * @return {Promise<boolean>} Returns true if the user has the required permissions and invites are allowed, otherwise false.
	 */
	async canActivate(route: ActivatedRouteSnapshot): Promise<boolean> {
		let hasPermission = false;
		const expectedPermissions: PermissionsEnum[] = route.data['expectedPermissions'];

		// Retrieve user role permissions
		const userRolePermissions = await firstValueFrom(this.store.userRolePermissions$);
		if (userRolePermissions) {
			hasPermission = expectedPermissions.some((permission) => this.store.hasPermission(permission));
		}

		// Retrieve selected organization
		const organization: IOrganization = await firstValueFrom(this.store.selectedOrganization$);
		const organizationInvitesAllowed = organization ? organization.invitesAllowed : false;

		// Check conditions
		if (organizationInvitesAllowed && hasPermission) {
			return true;
		}

		// Redirect to home if conditions are not met
		await this.router.navigate(['/']);
		return hasPermission;
	}
}
