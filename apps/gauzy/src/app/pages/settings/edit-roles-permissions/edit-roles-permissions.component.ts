import { Component, OnDestroy, OnInit } from '@angular/core';
import {
	PermissionGroups,
	IRolePermission,
	RolesEnum,
	IUser,
	IRole,
	PermissionsEnum
} from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslationBaseComponent } from '../../../@shared/language-base';
import {
	RolePermissionsService,
	RoleService,
	Store,
	ToastrService
} from '../../../@core/services';
import { environment } from './../../../../environments/environment';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-edit-org-roles-permissions',
	templateUrl: './edit-roles-permissions.component.html',
	styleUrls: ['./edit-roles-permissions.component.scss']
})
export class EditRolesPermissionsComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {

	rolesEnum = RolesEnum;
	permissionGroups = PermissionGroups;
	
	user: IUser;
	role: IRole;
	roles: IRole[] = [];
	permissions: IRolePermission[] = [];
	selectedRole: RolesEnum = RolesEnum.EMPLOYEE;
	
	loading: boolean;
	enabledPermissions: any = {};

	permissions$: Subject<any> = new Subject();
	
	constructor(
		public readonly translateService: TranslateService,
		private readonly toastrService: ToastrService,
		private readonly rolePermissionsService: RolePermissionsService,
		private readonly rolesService: RoleService,
		private readonly store: Store
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.store.user$
			.pipe(
				filter((user: IUser) => !!user),
				tap((user: IUser) => (this.user = user)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.permissions$
			.pipe(
				debounceTime(300),
				tap(() => this.loading = true),
				tap(() => this.loadPermissions()),
				untilDestroyed(this)
			)
			.subscribe();
		this.rolesService.getAll()
			.then(({ items }) => {
				this.roles = items;
				this.onSelectedRole();
			});
	}

	async loadPermissions() {
		this.enabledPermissions = {};

		const { tenantId } = this.user;
		const { id: roleId } = this.role;

		this.permissions = (
			await this.rolePermissionsService.getRolePermissions({
				roleId,
				tenantId
			})
			.finally(() => this.loading = false)
		).items;

		this.permissions.forEach((p) => {
			this.enabledPermissions[p.permission] = p.enabled;
		});
	}

	async permissionChanged(permission: string, enabled: boolean) {
		try {
			const { id: roleId } = this.role;
			const { tenantId } = this.user;

			const permissionToEdit = this.permissions.find(
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
						roleId,
						permission,
						enabled,
						tenantId
				  });
			this.toastrService.success(
				this.getTranslation('TOASTR.MESSAGE.PERMISSION_UPDATED', {
					permissionName: this.getTranslation('ORGANIZATIONS_PAGE.PERMISSIONS.' + permission),
					roleName: this.getTranslation('USERS_PAGE.ROLE.' + this.selectedRole)
				}),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		} catch (error) {
			this.toastrService.danger(
				this.getTranslation('TOASTR.MESSAGE.PERMISSION_UPDATE_ERROR'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		} finally {
			this.permissions$.next(true);
		}
	}

	/**
	 * CHANGE current selected role
	 */
	onSelectedRole() {
		this.role = this.getRoleByName(this.selectedRole);
		this.permissions$.next(true);
	}

	/**
	 * GET role by name
	 * 
	 * @param name 
	 * @returns 
	 */
	getRoleByName(name: IRole['name']) {
		return this.roles.find(
			(role: IRole) => name === role.name
		);
	}

	/***
	 * GET Administration permissions & removed some permission in DEMO
	 */
	getAdministrationPermissions(): PermissionsEnum[] {
		// removed permissions for all users in DEMO mode
		const deniedPermisisons = [
			PermissionsEnum.ACCESS_DELETE_ACCOUNT,
			PermissionsEnum.ACCESS_DELETE_ALL_DATA
		];

		return this.permissionGroups.ADMINISTRATION
					.filter((permission) => environment.DEMO ? !deniedPermisisons.includes(permission) : true)
	}

	ngOnDestroy() {}
}
