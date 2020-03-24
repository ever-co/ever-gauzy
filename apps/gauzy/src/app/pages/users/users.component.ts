import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
	Role,
	InvitationTypeEnum,
	PermissionsEnum,
	UserOrganization,
	Organization,
	UserOrganizationCreateInput,
	RolesEnum,
	User
} from '@gauzy/models';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { LocalDataSource } from 'ng2-smart-table';
import { Subject } from 'rxjs';
import { first, takeUntil } from 'rxjs/operators';
import { Store } from '../../@core/services/store.service';
import { UsersOrganizationsService } from '../../@core/services/users-organizations.service';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { UserMutationComponent } from '../../@shared/user/user-mutation/user-mutation.component';
import { UserFullNameComponent } from './table-components/user-fullname/user-fullname.component';
import { InviteMutationComponent } from '../../@shared/invite/invite-mutation/invite-mutation.component';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { UsersService } from '../../@core/services';

interface UserViewModel {
	fullName: string;
	email: string;
	bonus?: number;
	endWork?: any;
	id: string;
}

@Component({
	templateUrl: './users.component.html',
	styleUrls: ['./users.component.scss']
})
export class UsersComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	organizationName: string;
	settingsSmartTable: object;
	sourceSmartTable = new LocalDataSource();
	selectedUser: UserViewModel;
	selectedOrganizationId: string;
	UserRole: Role;

	private _ngDestroy$ = new Subject<void>();

	userName = 'User';

	organization: Organization;
	loading = true;
	hasEditPermission = false;
	hasInviteEditPermission = false;
	hasInviteViewOrEditPermission = false;
	organizationInvitesAllowed = false;
	showAddCard: boolean;
	userToEdit: UserOrganization;
	users: User[] = [];

	@ViewChild('usersTable', { static: false }) usersTable;

	constructor(
		private dialogService: NbDialogService,
		private store: Store,
		private router: Router,
		private toastrService: NbToastrService,
		private route: ActivatedRoute,
		private translate: TranslateService,
		private userOrganizationsService: UsersOrganizationsService,
		private readonly usersService: UsersService
	) {
		super(translate);
	}

	async ngOnInit() {
		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((organization) => {
				if (organization) {
					this.showAddCard = false;
					this.loadUsers();
					this.selectedOrganizationId = organization.id;
					this.organizationInvitesAllowed =
						organization.invitesAllowed;
					this.loadPage();
				}
			});

		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();

		this.store.userRolePermissions$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.hasEditPermission = this.store.hasPermission(
					PermissionsEnum.ORG_USERS_EDIT
				);
				this.hasInviteEditPermission = this.store.hasPermission(
					PermissionsEnum.ORG_INVITE_EDIT
				);
				this.hasInviteViewOrEditPermission =
					this.store.hasPermission(PermissionsEnum.ORG_INVITE_VIEW) ||
					this.hasInviteEditPermission;
			});

		this.route.queryParamMap
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((params) => {
				if (params.get('openAddDialog')) {
					this.add();
				}
			});
	}

	selectUserTmp(ev: {
		data: UserViewModel;
		isSelected: boolean;
		selected: UserViewModel[];
		source: LocalDataSource;
	}) {
		if (ev.isSelected) {
			this.selectedUser = ev.data;
			const checkName = this.selectedUser.fullName.trim();
			this.userName = checkName ? checkName : 'User';
		} else {
			this.selectedUser = null;
		}
	}

	async add() {
		const dialog = this.dialogService.open(UserMutationComponent);

		const data = await dialog.onClose.pipe(first()).toPromise();

		if (data) {
			if (data.user.firstName || data.user.lastName) {
				this.userName = data.user.firstName + ' ' + data.user.lastName;
			}
			this.toastrService.primary(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.ADD_NEW_USER_TO_ORGANIZATION',
					{
						username: this.userName.trim(),
						orgname: this.store.selectedOrganization.name
					}
				),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);

			this.loadPage();
		}
	}

	async addOrEditUser(user: UserOrganizationCreateInput) {
		if (user.isActive) {
			await this.userOrganizationsService
				.create(user)
				.pipe(first())
				.toPromise();

			this.toastrService.primary(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.ADD_NEW_USER_TO_ORGANIZATION',
					{
						username: this.userName.trim(),
						orgname: this.store.selectedOrganization.name
					}
				),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);

			this.showAddCard = false;
			this.loadPage();
		}
	}

	async invite() {
		const dialog = this.dialogService.open(InviteMutationComponent, {
			context: {
				invitationType: InvitationTypeEnum.USER,
				selectedOrganizationId: this.selectedOrganizationId,
				currentUserId: this.store.userId
			}
		});

		await dialog.onClose.pipe(first()).toPromise();
	}

	edit() {
		this.router.navigate(['/pages/users/edit/' + this.selectedUser.id]);
	}

	manageInvites() {
		this.router.navigate(['/pages/users/invites/']);
	}

	async delete() {
		this.dialogService
			.open(DeleteConfirmationComponent, {
				context: {
					recordType:
						this.selectedUser.fullName +
						' ' +
						this.getTranslation('FORM.DELETE_CONFIRMATION.USER')
				}
			})
			.onClose.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (result) => {
				if (result) {
					try {
						await this.userOrganizationsService.setUserAsInactive(
							this.selectedUser.id
						);

						this.toastrService.primary(
							this.getTranslation(
								'NOTES.ORGANIZATIONS.DELETE_USER_FROM_ORGANIZATION',
								{
									username: this.userName
								}
							),
							this.getTranslation('TOASTR.TITLE.SUCCESS')
						);

						this.loadPage();
					} catch (error) {
						this.toastrService.danger(
							this.getTranslation(
								'NOTES.ORGANIZATIONS.DATA_ERROR',
								{
									error: error.error.message || error.message
								}
							),
							this.getTranslation('TOASTR.TITLE.ERROR')
						);
					}
				}
			});
	}

	cancel() {
		this.userToEdit = null;
		this.showAddCard = !this.showAddCard;
	}

	private async loadUsers() {
		if (!this.organization) {
			return;
		}

		const { items } = await this.userOrganizationsService.getAll(['user'], {
			orgId: this.organization.id
		});

		this.users = items.map((user) => user.user);
	}

	async remove() {
		const user = await this.usersService.getUserByEmail(
			this.selectedUser.email
		);

		const { items } = await this.userOrganizationsService.getAll([
			'user',
			'user.role'
		]);

		let counter = 0;

		let userToRemove;

		for (const orgUser of items) {
			if (
				orgUser.isActive &&
				(!orgUser.user.role ||
					orgUser.user.role.name !== RolesEnum.EMPLOYEE)
			) {
				userToRemove = orgUser;
				if (userToRemove.user.id === user.id) {
					counter++;
				}
			}
		}

		if (counter - 1 < 1) {
			this.dialogService
				.open(DeleteConfirmationComponent, {
					context: {
						recordType:
							this.selectedUser.fullName +
							' ' +
							this.getTranslation(
								'FORM.DELETE_CONFIRMATION.DELETE_USER'
							)
					}
				})
				.onClose.pipe(takeUntil(this._ngDestroy$))
				.subscribe(async (result) => {
					if (result) {
						try {
							this.usersService.delete(
								userToRemove.user.id,
								userToRemove
							);

							this.toastrService.primary(
								this.userName + ' was successfuly deleted.',
								'Success'
							);

							this.loadPage();
						} catch (error) {
							this.toastrService.danger(
								error.error.message || error.message,
								'Error'
							);
						}
					}
				});
		} else {
			this.dialogService
				.open(DeleteConfirmationComponent, {
					context: {
						recordType:
							this.selectedUser.fullName +
							' ' +
							this.getTranslation(
								'FORM.DELETE_CONFIRMATION.USER_RECORD'
							)
					}
				})
				.onClose.pipe(takeUntil(this._ngDestroy$))
				.subscribe(async (result) => {
					if (result) {
						try {
							await this.userOrganizationsService.removeUserFromOrg(
								this.selectedUser.id
							);

							this.toastrService.primary(
								this.userName +
									' was successfuly removed from organization.',
								'Success'
							);

							this.loadPage();
						} catch (error) {
							this.toastrService.danger(
								error.error.message || error.message,
								'Error'
							);
						}
					}
				});
		}
	}

	private async loadPage() {
		this.selectedUser = null;

		const { items } = await this.userOrganizationsService.getAll(
			['user', 'user.role'],
			{
				orgId: this.selectedOrganizationId
			}
		);

		const { name } = this.store.selectedOrganization;
		const usersVm = [];

		for (const orgUser of items) {
			if (
				orgUser.isActive &&
				(!orgUser.user.role ||
					orgUser.user.role.name !== RolesEnum.EMPLOYEE)
			) {
				usersVm.push({
					fullName: `${orgUser.user.firstName || ''} ${orgUser.user
						.lastName || ''}`,
					email: orgUser.user.email,
					id: orgUser.id,
					isActive: orgUser.isActive,
					imageUrl: orgUser.user.imageUrl,
					roleName: orgUser.user.role
						? this.getTranslation(
								`USERS_PAGE.ROLE.${orgUser.user.role.name}`
						  )
						: ''
				});
			}
		}

		this.sourceSmartTable.load(usersVm);

		if (this.usersTable) {
			this.usersTable.grid.dataSet.willSelect = 'false';
		}

		this.organizationName = name;

		this.loading = false;
	}

	private _loadSmartTableSettings() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				fullName: {
					title: this.getTranslation('SM_TABLE.FULL_NAME'),
					type: 'custom',
					renderComponent: UserFullNameComponent,
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
		this.translate.onLangChange
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this._loadSmartTableSettings();
			});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
