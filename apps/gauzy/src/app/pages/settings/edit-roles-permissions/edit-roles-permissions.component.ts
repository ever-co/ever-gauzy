import { Component, OnDestroy, OnInit } from '@angular/core';
import {
	Organization,
	RolePermissions,
	RolesEnum,
	PermissionGroups
} from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { RolePermissionsService } from 'apps/gauzy/src/app/@core/services/role-permissions.service';
import { RoleService } from 'apps/gauzy/src/app/@core/services/role.service';
import { Subject } from 'rxjs';
import { first } from 'rxjs/operators';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { Store } from '../../../@core/services/store.service';

@Component({
	selector: 'ga-edit-org-roles-permissions',
	templateUrl: './edit-roles-permissions.component.html',
	styleUrls: ['./edit-roles-permissions.component.scss']
})
export class EditRolesPermissionsComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();

	organization: Organization;

	selectedRole: RolesEnum = RolesEnum.EMPLOYEE;
	superAdminRole: RolesEnum = RolesEnum.SUPER_ADMIN;
	selectedRoleId: string;

	allRoles: string[] = Object.values(RolesEnum);

	loading = true;

	permissionGroups = PermissionGroups;

	enabledPermissions = {};
	allPermissions: RolePermissions[] = [];

	constructor(
		readonly translateService: TranslateService,
		private readonly toastrService: NbToastrService,
		private readonly rolePermissionsService: RolePermissionsService,
		private readonly rolesService: RoleService,
		private readonly store: Store
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.loadPermissionsForSelectedRole();
	}

	async updateOrganizationSettings() {
		this.toastrService.primary(
			this.organization.name + ' organization settings updated.',
			'Success'
		);
		this.goBack();
	}

	goBack() {
		const currentURL = window.location.href;
		window.location.href = currentURL.substring(
			0,
			currentURL.indexOf('/settings')
		);
	}

	async loadPermissionsForSelectedRole() {
		this.enabledPermissions = {};
		this.loading = true;
		const role = await this.rolesService
			.getRoleByName({
				name: this.selectedRole,
				tenant: this.store.user.tenant
			})
			.pipe(first())
			.toPromise();

		this.selectedRoleId = role.id;

		await this.refreshPermissions();

		this.loading = false;
	}

	async refreshPermissions() {
		const { items } = await this.rolePermissionsService.getRolePermissions({
			roleId: this.selectedRoleId
		});

		items.forEach((p) => {
			this.enabledPermissions[p.permission] = p.enabled;
		});

		this.allPermissions = items;
	}

	async permissionChanged(permission, enabled) {
		try {
			const permissionToEdit = this.allPermissions.find(
				(p) => p.permission === permission
			);

			permissionToEdit && permissionToEdit.id
				? await this.rolePermissionsService.update(
						permissionToEdit.id,
						{
							enabled
						}
				  )
				: await this.rolePermissionsService.create({
						roleId: this.selectedRoleId,
						permission,
						enabled,
						tenant: this.store.user.tenant
				  });

			await this.refreshPermissions();

			this.toastrService.success(
				this.getTranslation('TOASTR.MESSAGE.PERMISSION_UPDATED', {
					permissionName: this.getTranslation(
						'ORGANIZATIONS_PAGE.PERMISSIONS.' + permission
					),
					roleName: this.getTranslation(
						'USERS_PAGE.ROLE.' + this.selectedRole
					)
				}),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		} catch (error) {
			this.toastrService.danger(
				this.getTranslation('TOASTR.MESSAGE.PERMISSION_UPDATE_ERROR'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		}
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
