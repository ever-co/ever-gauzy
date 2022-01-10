import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
	InvitationTypeEnum,
	PermissionsEnum,
	IOrganization,
	IUserOrganizationCreateInput,
	RolesEnum,
	IUser,
	ComponentLayoutStyleEnum,
	IRolePermission,
	IUserViewModel,
	IUserOrganization
} from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { filter, tap } from 'rxjs/operators';
import { debounceTime, firstValueFrom, Subject, of as observableOf, map, finalize } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/common-angular';
import { Store, ToastrService, UsersOrganizationsService } from '../../@core/services';
import { DeleteConfirmationComponent } from '../../@shared/user/forms';
import { UserMutationComponent } from '../../@shared/user/user-mutation/user-mutation.component';
import { InviteMutationComponent } from '../../@shared/invite/invite-mutation/invite-mutation.component';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { PictureNameTagsComponent } from '../../@shared/table-components';
import { ComponentEnum } from '../../@core/constants';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './users.component.html',
	styleUrls: ['./users.component.scss']
})
export class UsersComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {

	settingsSmartTable: object;
	sourceSmartTable = new LocalDataSource();
	selectedUser: IUserViewModel;

	userName = 'User';

	loading: boolean;
	hasSuperAdminPermission: boolean = false;
	organizationInvitesAllowed: boolean = false;
	showAddCard: boolean;
	disableButton = true;

	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	
	users: IUser[] = [];
	subject$: Subject<any> = new Subject();
	organization: IOrganization;

	usersTable: Ng2SmartTableComponent;
	@ViewChild('usersTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.usersTable = content;
			this.onChangedSource();
		}
	}

	constructor(
		private readonly dialogService: NbDialogService,
		private readonly store: Store,
		private readonly router: Router,
		private readonly toastrService: ToastrService,
		private readonly route: ActivatedRoute,
		public readonly translateService: TranslateService,
		private readonly userOrganizationsService: UsersOrganizationsService
	) {
		super(translateService);
		this.setView();
	}

	async ngOnInit() {
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();
		this.subject$
			.pipe(
				debounceTime(300),
				tap(() => this.loading = true),
				tap(() => this.getUsers()),
				tap(() => this.cancel()),
				tap(() => this.clearItem()),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				distinctUntilChange(),
				tap((organization: IOrganization) => this.organization = organization),
				tap(({ invitesAllowed }: IOrganization) => this.organizationInvitesAllowed = invitesAllowed),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.userRolePermissions$
			.pipe(
				filter(
					(permissions: IRolePermission[]) => permissions.length > 0
				),
				untilDestroyed(this)
			)
			.subscribe(() => {
				this.hasSuperAdminPermission = this.store.hasPermission(
					PermissionsEnum.SUPER_ADMIN_EDIT
				);
			});
		this.route.queryParamMap
			.pipe(
				filter((params) => !!params && params.get('openAddDialog') === 'true'),
				debounceTime(1000),
				tap(() => this.add()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	setView() {
		this.viewComponentName = ComponentEnum.USERS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout: ComponentLayoutStyleEnum) => this.dataLayoutStyle = componentLayout),
				untilDestroyed(this)
			)
			.subscribe();
	}

	selectUser({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedUser = isSelected ? data : null;

		if (this.selectedUser) {
			const checkName = data.fullName.trim();
			this.userName = checkName ? checkName : 'User';
		}

		if (data && data.role === RolesEnum.SUPER_ADMIN) {
			this.disableButton = !this.hasSuperAdminPermission;
			this.selectedUser = this.hasSuperAdminPermission
				? this.selectedUser
				: null;
		}
	}

	async add() {
		const dialog = this.dialogService.open(UserMutationComponent);
		const data = await firstValueFrom(dialog.onClose);
		
		if (data && data.user) {
			if (data.user.firstName || data.user.lastName) {
				this.userName = data.user.firstName + ' ' + data.user.lastName;
			}
			this.toastrService.success('NOTES.ORGANIZATIONS.ADD_NEW_USER_TO_ORGANIZATION', {
				username: this.userName.trim(),
				orgname: this.store.selectedOrganization.name
			});
			this.subject$.next(true);
		}
	}

	async addOrEditUser(user: IUserOrganizationCreateInput) {
		if (user.isActive) {
			await firstValueFrom(this.userOrganizationsService
				.create(user)
			);

			this.toastrService.success(
				'NOTES.ORGANIZATIONS.ADD_NEW_USER_TO_ORGANIZATION',
				{
					username: this.userName.trim(),
					orgname: this.store.selectedOrganization.name
				}
			);
			this.subject$.next(true);
		}
	}

	async invite() {
		const dialog = this.dialogService.open(InviteMutationComponent, {
			context: {
				invitationType: InvitationTypeEnum.USER
			}
		});
		await firstValueFrom(dialog.onClose);
	}

	edit(selectedItem?: IUser) {
		if (selectedItem) {
			this.selectUser({
				isSelected: true,
				data: selectedItem
			});
		}
		this.router.navigate(['/pages/users/edit/' + this.selectedUser.id]);
	}

	manageInvites() {
		this.router.navigate(['/pages/users/invites/']);
	}

	async delete(selectedItem?: IUser) {
		if (selectedItem) {
			this.selectUser({
				isSelected: true,
				data: selectedItem
			});
		}
		this.dialogService
			.open(DeleteConfirmationComponent, {
				context: {
					recordType:
						this.selectedUser.fullName +
						' ' +
						this.getTranslation('FORM.DELETE_CONFIRMATION.USER')
				}
			})
			.onClose.pipe(untilDestroyed(this))
			.subscribe(async (result) => {
				if (result) {
					try {
						await this.userOrganizationsService.setUserAsInactive(
							this.selectedUser.id
						);
						this.toastrService.success('NOTES.ORGANIZATIONS.DELETE_USER_FROM_ORGANIZATION', {
							username: this.userName
						});
						this.subject$.next(true);
					} catch (error) {
						this.toastrService.danger(error);
					}
				}
			});
	}

	cancel() {
		this.showAddCard = false;
	}

	async remove(selectedOrganization: IUserViewModel) {
		const { userOrganizationId } = selectedOrganization;
		const fullName = selectedOrganization.fullName.trim() || selectedOrganization.email;

		/**
		 *  User belongs to only 1 organization -> delete user
		 *	User belongs multiple organizations -> remove user from Organization
		 *
		 */
		const count = await this.userOrganizationsService.getUserOrganizationCount(
			userOrganizationId
		);
		const confirmationMessage =
			count === 1
				? 'FORM.DELETE_CONFIRMATION.DELETE_USER'
				: 'FORM.DELETE_CONFIRMATION.REMOVE_USER';

		this.dialogService
			.open(DeleteConfirmationComponent, {
				context: {
					recordType: `${fullName} ${this.getTranslation(
						confirmationMessage
					)}`
				}
			})
			.onClose
			.pipe(untilDestroyed(this))
			.subscribe(async (result) => {
				if (result) {
					try {
						await this.userOrganizationsService.removeUserFromOrg(
							userOrganizationId
						);
						this.toastrService.success('USERS_PAGE.REMOVE_USER', {
							name: fullName
						});
						this.subject$.next(true);
					} catch (error) {
						this.toastrService.danger(error);
					}
				}
			});
	}

	private async getUsers() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const organizations: IUserOrganization[] = [];
		observableOf((
			await this.userOrganizationsService.getAll(
				['user', 'user.role', 'user.tags'],
				{ organizationId, tenantId }
			)).items
		).pipe(
			map((organizations: IUserOrganization[]) => organizations
				.filter((organizaiton: IUserOrganization) => organizaiton.isActive)
				.filter((organizaiton: IUserOrganization) => organizaiton.user.role)
				.filter((organizaiton: IUserOrganization) => organizaiton.user.role.name !== RolesEnum.EMPLOYEE)
			),
			tap((users: IUserOrganization[]) => organizations.push(...users)),
			untilDestroyed(this),
			finalize(() => this.loading = false)
		).subscribe();

		const users = [];
		for (const { id: userOrganizationId, user, isActive } of organizations) {
			users.push({
				id: user.id,
				fullName: user.name,
				email: user.email,
				tags: user.tags,
				imageUrl: user.imageUrl,
				role: user.role.name,
				isActive: isActive,
				userOrganizationId: userOrganizationId
			});
		}

		this.users = users;
		this.sourceSmartTable.load(users);
	}

	private _loadSmartTableSettings() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				fullName: {
					title: this.getTranslation('SM_TABLE.FULL_NAME'),
					type: 'custom',
					renderComponent: PictureNameTagsComponent,
					class: 'align-row'
				},
				email: {
					title: this.getTranslation('SM_TABLE.EMAIL'),
					type: 'email'
				},
				role: {
					title: this.getTranslation('SM_TABLE.ROLE'),
					type: 'text'
				}
			},
			pager: {
				display: true,
				perPage: 8
			}
		};
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.usersTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this.clearItem())
			)
			.subscribe();
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
		this.selectUser({
			isSelected: false,
			data: null
		});
		this.deselectAll();
	}
	
	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.usersTable && this.usersTable.grid) {
			this.usersTable.grid.dataSet['willSelect'] = 'false';
			this.usersTable.grid.dataSet.deselectAll();
		}
	}

	ngOnDestroy() { }
}
