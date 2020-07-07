import { Store } from '../../@core/services/store.service';
import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router } from '@angular/router';
import { first, takeUntil } from 'rxjs/operators';
import { PermissionsEnum } from '@gauzy/models';
import { Subject } from 'rxjs';

@Injectable()
export class InviteGuard implements CanActivate {
	hasPermission = false;
	organizationInvitesAllowed = false;
	private _ngDestroy$ = new Subject<void>();
	constructor(
		private readonly router: Router,
		private readonly store: Store
	) {}

	async canActivate(route: ActivatedRouteSnapshot) {
		const expectedPermissions: PermissionsEnum[] = route.data.expectedPermissions;
		this.store.userRolePermissions$
			.pipe(takeUntil(this._ngDestroy$))
			// .pipe(first())
			.subscribe(() => {
			console.log('this.store.userRolePermission', this.store.userRolePermissions);
			this.hasPermission = expectedPermissions.some((permission) => this.store.hasPermission(permission));

		});
		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			// .pipe(first())
			.subscribe((organization) => {
				if (organization) {
					console.log('this.store.selectedOrganization-->', this.store.selectedOrganization)
					this.organizationInvitesAllowed = organization.invitesAllowed;
				}
			});

		console.log('this.organizationInvitesAllowed ', this.organizationInvitesAllowed );
		console.log('this.hasPermission ', this.hasPermission );

		if (this.organizationInvitesAllowed && this.hasPermission) {
			return true;
		}

		this.router.navigate(['/']);

		return false;
	}
}
