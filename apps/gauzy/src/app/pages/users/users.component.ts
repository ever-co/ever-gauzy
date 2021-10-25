import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {
	ActivatedRoute,
	Router,
	RouterEvent,
	NavigationEnd
} from '@angular/router';
import {
	IRole,
	InvitationTypeEnum,
	PermissionsEnum,
	IUserOrganization,
	IOrganization,
	IUserOrganizationCreateInput,
	RolesEnum,
	IUser,
	ITag,
	ComponentLayoutStyleEnum,
	IRolePermission,
	IUserViewModel
} from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { filter, tap } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { Store } from '../../@core/services/store.service';
import { UsersOrganizationsService } from '../../@core/services/users-organizations.service';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { UserMutationComponent } from '../../@shared/user/user-mutation/user-mutation.component';
import { InviteMutationComponent } from '../../@shared/invite/invite-mutation/invite-mutation.component';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { PictureNameTagsComponent } from '../../@shared/table-components/picture-name-tags/picture-name-tags.component';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ToastrService } from '../../@core/services/toastr.service';

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
	selectedOrganizationId: string;
	UserRole: IRole;
	userToRemoveId: string;
	userToRemove: IUserOrganization;

	userName = 'User';

	organization: IOrganization;
	loading = true;
	hasSuperAdminPermission = false;
	organizationInvitesAllowed = false;
	showAddCard: boolean;
	userToEdit: IUserOrganization;
	users: IUser[] = [];
	tags: ITag[];
	selectedTags: any;
	viewComponentName: ComponentEnum;
	disableButton = true;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	userData: IUser[];

	usersTable: Ng2SmartTableComponent;
	@ViewChild('usersTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.usersTable = content;
			this.onChangedSource();
		}
	}

	constructor(
		private dialogService: NbDialogService,
		private store: Store,
		private router: Router,
		private toastrService: ToastrService,
		private route: ActivatedRoute,
		private translate: TranslateService,
		private userOrganizationsService: UsersOrganizationsService
	) {
		super(translate);
		this.setView();
	}

	async ngOnInit() {
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe((organization: IOrganization) => {
				if (organization) {
					this.organization = organization;
					this.selectedOrganizationId = organization.id;
					this.organizationInvitesAllowed =
						organization.invitesAllowed;
					this.cancel();
					this.loadPage();
				}
			});
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
			.pipe(untilDestroyed(this))
			.subscribe((params) => {
				if (params.get('openAddDialog')) {
					this.add();
				}
			});
		this.router.events
			.pipe(untilDestroyed(this))
			.subscribe((event: RouterEvent) => {
				if (event instanceof NavigationEnd) {
					this.setView();
				}
			});
	}

	setView() {
		this.viewComponentName = ComponentEnum.USERS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(untilDestroyed(this))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
			});
	}

	selectUserTmp({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedUser = isSelected ? data : null;

		if (this.selectedUser) {
			this.userToRemoveId = data.id;
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
		const dialog = this.dialogService.open(UserMutationComponent, {
			context: {
				isSuperAdmin: this.hasSuperAdminPermission
			}
		});

		const data = await firstValueFrom(dialog.onClose);
		if (data && data.user) {
			if (data.user.firstName || data.user.lastName) {
				this.userName = data.user.firstName + ' ' + data.user.lastName;
			}
			this.toastrService.success(
				'NOTES.ORGANIZATIONS.ADD_NEW_USER_TO_ORGANIZATION',
				{
					username: this.userName.trim(),
					orgname: this.store.selectedOrganization.name
				}
			);
			this.loadPage();
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
			this.showAddCard = false;
			this.loadPage();
		}
	}

	async invite() {
		const dialog = this.dialogService.open(InviteMutationComponent, {
			context: {
				invitationType: InvitationTypeEnum.USER,
				isSuperAdmin: this.hasSuperAdminPermission
			}
		});
		await firstValueFrom(dialog.onClose);
	}

	edit(selectedItem?: IUser) {
		if (selectedItem) {
			this.selectUserTmp({
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
			this.selectUserTmp({
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

						this.toastrService.success(
							'NOTES.ORGANIZATIONS.DELETE_USER_FROM_ORGANIZATION',
							{
								username: this.userName
							}
						);
						this.loadPage();
					} catch (error) {
						this.toastrService.danger(error);
					}
				}
			});
	}

	cancel() {
		this.userToEdit = null;
		this.showAddCard = false;
	}

	async remove(selectedOrganization: IUserViewModel) {
		const { id: userOrganizationId } = selectedOrganization;
		const fullName =
			selectedOrganization.fullName.trim() || selectedOrganization.email;

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
			.onClose.pipe(untilDestroyed(this))
			.subscribe(async (result) => {
				if (result) {
					try {
						await this.userOrganizationsService.removeUserFromOrg(
							userOrganizationId
						);

						this.toastrService.success('USERS_PAGE.REMOVE_USER', {
							name: fullName
						});
						this.loadPage();
					} catch (error) {
						this.toastrService.danger(error);
					}
				}
			});
	}

	private async loadPage() {
		this.selectedUser = null;
		const { id: organizationId, tenantId } = this.organization;
		const { items } = await this.userOrganizationsService.getAll(
			['user', 'user.role', 'user.tags'],
			{ organizationId, tenantId }
		);

		this.users = items
			.filter((orgUser) => orgUser.user.role.name !== RolesEnum.EMPLOYEE)
			.map((user) => user.user);

		const usersVm = [];
		for (const orgUser of items) {
			if (
				orgUser.isActive &&
				(!orgUser.user.role ||
					orgUser.user.role.name !== RolesEnum.EMPLOYEE)
			) {
				usersVm.push({
					fullName: `${orgUser.user.firstName || ''} ${orgUser.user.lastName || ''
						}`,
					email: orgUser.user.email,
					tags: orgUser.user.tags,
					id: orgUser.id,
					isActive: orgUser.isActive,
					imageUrl: orgUser.user.imageUrl,
					role: orgUser.user.role.name,
					roleName: orgUser.user.role
						? this.getTranslation(
							`USERS_PAGE.ROLE.${orgUser.user.role.name}`
						)
						: ''
				});
			}
		}
		this.userData = usersVm;
		this.sourceSmartTable.load(usersVm);
		this.loading = false;
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
				roleName: {
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
		this.translate.onLangChange.pipe(untilDestroyed(this)).subscribe(() => {
			this._loadSmartTableSettings();
		});
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
		this.selectUserTmp({
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
