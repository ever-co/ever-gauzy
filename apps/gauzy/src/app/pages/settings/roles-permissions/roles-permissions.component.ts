import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { Observable, Subject, of as observableOf, startWith, catchError } from 'rxjs';
import { debounceTime, filter, tap, map } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { environment } from '@gauzy/ui-config';
import { PermissionGroups, IRolePermission, RolesEnum, IUser, IRole, PermissionsEnum } from '@gauzy/contracts';
import { RolePermissionsService, RoleService, Store, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

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
	filteredGeneralPermissions: PermissionsEnum[] = [];
	filteredAdminPermissions: PermissionsEnum[] = [];
	roles$: Observable<IRole[]> = observableOf([]);
	permissions$: Subject<any> = new Subject();
	roleSubject$: Subject<any> = new Subject();
	formControl: FormControl = new FormControl();
	searchControl = new FormControl('');
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

		this._setupSearchFilter();
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

	/**
	 * Loads and sets the enabled permissions for the current role.
	 */
	async loadPermissions(): Promise<void> {
		this.enabledPermissions = {};

		if (!this.role) return;

		try {
			const { id: roleId, tenantId } = this.role;

			// Fetch role permissions and update the enabledPermissions map
			const { items: permissions } = await this.rolePermissionsService.getRolePermissions({
				roleId,
				tenantId
			});

			this.permissions = permissions;
			this.permissions.forEach(({ permission, enabled }) => {
				this.enabledPermissions[permission] = enabled;
			});
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Handles the change in permission status and updates it accordingly.
	 *
	 * @param {string} permission - The name of the permission to be changed.
	 * @param {boolean} enabled - Indicates whether the permission should be enabled or disabled.
	 * @param {boolean} allowChange - Flag indicating whether the current user has the right to change the permission.
	 * @returns {Promise<void>}
	 */
	async permissionChanged(permission: string, enabled: boolean, allowChange: boolean): Promise<void> {
		// Check if the user has permission to make changes
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
			const payload = { enabled, roleId, tenantId, permission };

			// Update or create the permission based on its existence
			if (permissionToEdit?.id) {
				await this.rolePermissionsService.update(permissionToEdit.id, payload);
			} else {
				await this.rolePermissionsService.create(payload);
			}

			// Display success message
			this.toastrService.success(
				this.getTranslation('TOASTR.MESSAGE.PERMISSION_UPDATED', {
					permissionName: this.getTranslation('ORGANIZATIONS_PAGE.PERMISSIONS.' + permission),
					roleName: this.formControl.value
				}),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		} catch (error) {
			// Display error message
			this.toastrService.danger(
				this.getTranslation('TOASTR.MESSAGE.PERMISSION_UPDATE_ERROR'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		} finally {
			// Notify about permission update
			this.permissions$.next(true);
		}
	}

	/**
	 * Handles the change of the currently selected role.
	 */
	onSelectedRole(): void {
		this.role = this.getRoleByName(this.formControl.value);
		this.isWantToCreate = !this.role;
		this.permissions$.next(true);
	}

	/**
	 * Retrieves a role by its name.
	 *
	 * @param {string} name - The name of the role to retrieve.
	 * @returns {IRole | undefined} - The found role, or undefined if not found.
	 */
	getRoleByName(name: IRole['name']): IRole | undefined {
		return this.roles.find((role) => role.name === name);
	}

	/**
	 * Retrieves administration permissions, removing certain permissions in DEMO mode.
	 *
	 * @returns {PermissionsEnum[]} - The filtered list of administration permissions.
	 */
	getAdministrationPermissions(): PermissionsEnum[] {
		const deniedPermissions = new Set([
			PermissionsEnum.ACCESS_DELETE_ACCOUNT,
			PermissionsEnum.ACCESS_DELETE_ALL_DATA
		]);

		return this.permissionGroups.ADMINISTRATION.filter(
			(permission) => !environment.DEMO || !deniedPermissions.has(permission)
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
	 * Checks whether the General Group Permissions should be disabled.
	 *
	 * @returns {boolean} - Returns true if the general permissions are disabled; otherwise, false.
	 */
	isDisabledGeneralPermissions(): boolean {
		if (!this.role) return true;

		// Disable permissions for "SUPER_ADMIN" role and when the current user's role is "ADMIN"
		const userRole = this.user.role.name as RolesEnum;
		const roleName = this.role.name;

		return (
			(userRole === RolesEnum.SUPER_ADMIN && roleName === RolesEnum.SUPER_ADMIN) ||
			(userRole === RolesEnum.ADMIN && roleName === RolesEnum.ADMIN)
		);
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

	/**
	 * Sets up a search filter with debounce to improve performance.
	 */ private _setupSearchFilter(): void {
		this.searchControl.valueChanges
			.pipe(
				debounceTime(300),
				startWith(''),
				map((searchTerm) => {
					this.filteredGeneralPermissions = this._filterPermissions('GENERAL', searchTerm);
					this.filteredAdminPermissions = this._filterPermissions('ADMINISTRATION', searchTerm);
				})
			)
			.subscribe();
	}

	/**
	 * Filters permissions based on the search term.
	 * @param group The group of permissions to filter ('GENERAL' or 'ADMINISTRATION')
	 * @param searchTerm The term used for filtering permissions.
	 * @returns The filtered list of permissions.
	 */
	private _filterPermissions(group: 'GENERAL' | 'ADMINISTRATION', searchTerm: string | null = ''): any[] {
		const permissions = group === 'GENERAL' ? this.permissionGroups.GENERAL : this.getAdministrationPermissions();
		console.log(permissions);

		if (!searchTerm) return permissions;
		return permissions.filter((permission) =>
			this._formatPermissionForSearch(permission).includes(searchTerm.toLowerCase())
		);
	}

	private _formatPermissionForSearch(permission: string): string {
		return permission.replace(/_/g, ' ').toLowerCase();
	}

	ngOnDestroy() {}
}
