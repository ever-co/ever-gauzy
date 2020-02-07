import { Component, OnDestroy, OnInit } from '@angular/core';
import {
	Organization,
	PermissionsEnum,
	RolePermissions,
	RolesEnum
} from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { RolePermissionsService } from 'apps/gauzy/src/app/@core/services/role-permissions.service';
import { RoleService } from 'apps/gauzy/src/app/@core/services/role.service';
import { Subject } from 'rxjs';
import { first } from 'rxjs/operators';

@Component({
	selector: 'ga-edit-org-roles-permissions',
	templateUrl: './edit-roles-permissions.component.html',
	styleUrls: ['./edit-roles-permissions.component.scss']
})
export class EditRolesPermissionsComponent implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();

	organization: Organization;

	selectedRole: RolesEnum = RolesEnum.EMPLOYEE;
	selectedRoleId: string;

	allRoles: string[] = Object.values(RolesEnum);

	loading = true;

	permissionGroups = {
		GENERAL: [
			PermissionsEnum.ADMIN_DASHBOARD_VIEW,
			PermissionsEnum.ORG_EXPENSES_VIEW,
			PermissionsEnum.ORG_EXPENSES_EDIT,
			PermissionsEnum.ORG_INCOMES_EDIT,
			PermissionsEnum.ORG_INCOMES_VIEW,
			PermissionsEnum.ORG_PROPOSALS_EDIT,
			PermissionsEnum.ORG_PROPOSALS_VIEW,
			PermissionsEnum.ORG_TIME_OFF_VIEW
		],
		ADMINISTRATION: [
			PermissionsEnum.ORG_EMPLOYEES_VIEW,
			PermissionsEnum.ORG_EMPLOYEES_EDIT,
			PermissionsEnum.ORG_USERS_VIEW,
			PermissionsEnum.ORG_USERS_EDIT,
			PermissionsEnum.ALL_ORG_VIEW,
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.POLICY_VIEW,
			PermissionsEnum.POLICY_EDIT
		]
	};

	enabledPermissions = {};
	allPermissions: RolePermissions[] = [];

	constructor(
		private readonly translateService: TranslateService,
		private readonly toastrService: NbToastrService,
		private readonly rolePermissionsService: RolePermissionsService,
		private readonly rolesService: RoleService
	) {}

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
			.getRoleByName({ name: this.selectedRole })
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
						enabled
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

	getTranslation(prefix: string, params?: Object) {
		let result = '';
		this.translateService.get(prefix, params).subscribe((res) => {
			result = res;
		});

		return result;
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
