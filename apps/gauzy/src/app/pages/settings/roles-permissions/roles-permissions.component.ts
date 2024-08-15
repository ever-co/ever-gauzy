import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { PermissionGroups, IRolePermission, RolesEnum, IUser, IRole, PermissionsEnum } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { debounceTime, filter, tap, map } from 'rxjs/operators';
import { Observable, Subject, of as observableOf, startWith, catchError } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { environment } from '@gauzy/ui-config';
import { RolePermissionsService, RoleService, Store, ToastrService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-org-roles-permissions',
	templateUrl: './roles-permissions.component.html',
	styleUrls: ['./roles-permissions.component.scss']
})
export class RolesPermissionsComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	rolesEnum = RolesEnum;
	permissionGroups = PermissionGroups;
	isWantToCreate: boolean = false;
	loading: boolean;
	enabledPermissions: any = {};

	user: IUser;
	role: IRole;
	roles: IRole[] = [];
	permissions: IRolePermission[] = [];

	roles$: Observable<IRole[]> = observableOf([]);
	permissions$: Subject<any> = new Subject();

	roleSubject$: Subject<any> = new Subject();

	formControl: FormControl = new FormControl();
	@ViewChild('input') input: ElementRef;

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
		this.roleSubject$
			.pipe(
				debounceTime(100),
				tap(() => this.getRoles()),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.user$
			.pipe(
				filter((user: IUser) => !!user),
				tap((user: IUser) => (this.user = user)),
				tap(() => this.roleSubject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.roles$ = this.formControl.valueChanges.pipe(
			debounceTime(300),
			startWith(''),
			map((value: string) => this._filter(value))
		);
		this.permissions$
			.pipe(
				debounceTime(300),
				tap(() => (this.loading = true)),
				tap(() => this.loadPermissions()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Roles filters using substring
	 *
	 * @param value
	 * @returns
	 */
	private _filter(value: string): IRole[] {
		return this.roles.filter((role: IRole) => !!role);
	}

	/**
	 * Filtered roles options
	 *
	 * @param value
	 * @returns
	 */
	private _getFilteredOptions(value: string): Observable<IRole[]> {
		return observableOf(value).pipe(map((value) => this._filter(value)));
	}

	/**
	 * On autocomplete selection
	 * @param role
	 */
	onSelectionChange(role: IRole['name']) {
		if (role) {
			this.roles$ = this._getFilteredOptions(role);
			this.onSelectedRole();
		}
	}

	/**
	 * On input change
	 */
	onInputChange() {
		const nativeElementValue = this.input.nativeElement.value;
		if (nativeElementValue) {
			const [role] = this.roles.filter((role: IRole) => role.name === nativeElementValue);
			this.role = role;

			/**
			 * We want to create new role
			 */
			this.isWantToCreate = !this.roles.find((role: IRole) => role.name === nativeElementValue);
		}
	}

	async loadPermissions() {
		this.enabledPermissions = {};

		if (!this.role) {
			return;
		}

		const { tenantId } = this.user;
		const { id: roleId } = this.role;

		this.permissions = (
			await this.rolePermissionsService
				.getRolePermissions({
					roleId,
					tenantId
				})
				.finally(() => (this.loading = false))
		).items;

		this.permissions.forEach((p) => {
			this.enabledPermissions[p.permission] = p.enabled;
		});
	}

	async permissionChanged(permission: string, enabled: boolean, allowChange: boolean) {
		/**
		 * If anyone trying to update another users permissions without enough permisison
		 */
		if (!allowChange) {
			this.toastrService.danger(
				this.getTranslation('TOASTR.MESSAGE.PERMISSION_UPDATE_ERROR'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
			return;
		}
		try {
			const { id: roleId } = this.role;
			const { tenantId } = this.user;

			const permissionToEdit = this.permissions.find((p) => p.permission === permission);

			const payload = {
				enabled,
				roleId,
				tenantId,
				permission
			};
			permissionToEdit && permissionToEdit.id
				? await this.rolePermissionsService.update(permissionToEdit.id, {
						...payload
				  })
				: await this.rolePermissionsService.create({
						...payload
				  });
			this.toastrService.success(
				this.getTranslation('TOASTR.MESSAGE.PERMISSION_UPDATED', {
					permissionName: this.getTranslation('ORGANIZATIONS_PAGE.PERMISSIONS.' + permission),
					roleName: this.formControl.value
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
		this.role = this.getRoleByName(this.formControl.value);
		this.isWantToCreate = !this.role;
		this.permissions$.next(true);
	}

	/**
	 * GET role by name
	 *
	 * @param name
	 * @returns
	 */
	getRoleByName(name: IRole['name']) {
		return this.roles.find((role: IRole) => name === role.name);
	}

	/***
	 * GET Administration permissions & removed some permission in DEMO
	 */
	getAdministrationPermissions(): PermissionsEnum[] {
		// removed permissions for all users in DEMO mode
		const deniedPermissions = [PermissionsEnum.ACCESS_DELETE_ACCOUNT, PermissionsEnum.ACCESS_DELETE_ALL_DATA];

		return this.permissionGroups.ADMINISTRATION.filter((permission) =>
			environment.DEMO ? !deniedPermissions.includes(permission) : true
		);
	}

	/**
	 * GET all tenant roles
	 */
	async getRoles() {
		this.roles$ = observableOf((await this.rolesService.getAll()).items).pipe(
			map((roles: IRole[]) => roles),
			tap((roles: IRole[]) => (this.roles = roles)),
			tap(() => this.formControl.setValue(this.formControl.value || RolesEnum.EMPLOYEE))
		);
	}

	/**
	 * Create New Role
	 */
	createRole() {
		const value = this.input.nativeElement.value;
		this.rolesService
			.create({ name: value })
			.pipe(
				debounceTime(100),
				tap(() => this.roleSubject$.next(true)),
				tap(() => (this.isWantToCreate = false)),
				tap((role: IRole) => {
					this.toastrService.success(
						this.getTranslation('TOASTR.MESSAGE.ROLE_CREATED', {
							name: role.name
						}),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
				}),
				catchError((error) => {
					this.toastrService.error(
						this.getTranslation('TOASTR.MESSAGE.ROLE_CREATED_ERROR', {
							name: value
						}),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					throw new Error(error);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Delete existed role
	 */
	deleteRole() {
		if (!this.role.isSystem) {
			this.rolesService
				.delete(this.role)
				.pipe(
					debounceTime(100),
					tap(() => this.formControl.setValue('')),
					tap(() => this.roleSubject$.next(true)),
					tap((result: HttpErrorResponse) => {
						if (result.status === HttpStatusCode.Forbidden) {
							throw new Error();
						}
						this.toastrService.success(
							this.getTranslation('TOASTR.MESSAGE.ROLE_DELETED', {
								name: this.role.name
							}),
							this.getTranslation('TOASTR.TITLE.SUCCESS')
						);
					}),
					catchError((error) => {
						this.toastrService.error(
							this.getTranslation('TOASTR.MESSAGE.ROLE_DELETED_ERROR', {
								name: this.role.name
							}),
							this.getTranslation('TOASTR.TITLE.ERROR')
						);
						return observableOf(error);
					}),
					untilDestroyed(this)
				)
				.subscribe();
		}
	}

	/**
	 * Disabled General Group Permissions
	 *
	 * @returns
	 */
	isDisabledGeneralPermissions(): boolean {
		if (!this.role) {
			return true;
		}

		/**
		 * Disabled all permissions for "SUPER_ADMIN"
		 */
		const excludes = [RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN];
		if (excludes.includes(this.user.role.name as RolesEnum)) {
			if (this.role.name === RolesEnum.SUPER_ADMIN) {
				return true;
			}
		}
		if (this.user.role.name === RolesEnum.ADMIN) {
			if (this.role.name === RolesEnum.ADMIN) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Disabled General Group Permissions
	 *
	 * @returns
	 */
	isDisabledAdministrationPermissions(): boolean {
		if (!this.role) {
			return true;
		}
		/**
		 * Disabled all administration permissions except "SUPER_ADMIN"
		 */
		if (this.user.role.name === RolesEnum.SUPER_ADMIN) {
			if (this.role.name === RolesEnum.ADMIN) {
				return false;
			}
		}
		return true;
	}

	ngOnDestroy() {}
}
