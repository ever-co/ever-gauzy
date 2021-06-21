import { Store } from './../services/store.service';
import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router } from '@angular/router';
import { filter, first } from 'rxjs/operators';
import { IOrganization, PermissionsEnum } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy()
@Injectable()
export class InviteGuard implements CanActivate {
	hasPermission = false;
	organizationInvitesAllowed = false;

	constructor(
		private readonly router: Router,
		private readonly store: Store
	) {}

	async canActivate(route: ActivatedRouteSnapshot) {
		const expectedPermissions: PermissionsEnum[] =
			route.data.expectedPermissions;
		this.store.userRolePermissions$.pipe(first()).subscribe(() => {
			this.hasPermission = expectedPermissions.some((permission) =>
				this.store.hasPermission(permission)
			);
		});
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization), 
				first(), 
				untilDestroyed(this)
			)
			.subscribe((organization) => {
				if (organization) {
					this.organizationInvitesAllowed =
						organization.invitesAllowed;
				}
			});
		if (this.organizationInvitesAllowed && this.hasPermission) {
			return true;
		}

		this.router.navigate(['/']);
		return false;
	}
}
