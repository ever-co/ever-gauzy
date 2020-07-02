import { Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { InvitationTypeEnum, RolesEnum, PermissionsEnum } from '@gauzy/models';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { LocalDataSource } from 'ng2-smart-table';
import { Subject } from 'rxjs';
import { first, takeUntil } from 'rxjs/operators';
import { InviteService } from '../../../@core/services/invite.service';
import { Store } from '../../../@core/services/store.service';
import { DeleteConfirmationComponent } from '../../user/forms/delete-confirmation/delete-confirmation.component';
import { InviteMutationComponent } from '../invite-mutation/invite-mutation.component';
import { ProjectNamesComponent } from './project-names/project-names.component';
import moment = require('moment-timezone');
import { ResendConfirmationComponent } from './resend-confirmation/resend-confirmation.component';
import { ClientNamesComponent } from './client-names/client-names.component';
import { DepartmentNamesComponent } from './department-names/department-names.component';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';

interface InviteViewModel {
	email: string;
	expireDate: string;
	imageUrl: string;
	fullName: string;
	roleName?: string;
	status: string;
	projectNames: string[];
	clientNames: string[];
	departmentNames: string[];
	id: string;
	inviteUrl: string;
}

@Component({
	selector: 'ga-invites',
	templateUrl: './invites.component.html'
})
export class InvitesComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	@Input()
	invitationType: InvitationTypeEnum;

	organizationName: string;
	settingsSmartTable: object;
	sourceSmartTable = new LocalDataSource();
	selectedInvite: InviteViewModel;
	selectedOrganizationId: string;

	private _ngDestroy$ = new Subject<void>();

	invitedName = 'Employee / User';

	loading = true;

	hasInviteEditPermission = false;

	@ViewChild('employeesTable') employeesTable;

	constructor(
		private dialogService: NbDialogService,
		private store: Store,
		private toastrService: NbToastrService,
		private translate: TranslateService,
		private inviteService: InviteService
	) {
		super(translate);
	}

	async ngOnInit() {
		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((organization) => {
				if (organization) {
					this.selectedOrganizationId = organization.id;
					this.loadPage();
				}
			});
		this.store.userRolePermissions$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.hasInviteEditPermission = this.store.hasPermission(
					PermissionsEnum.ORG_INVITE_EDIT
				);
			});

		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();
	}

	selectEmployeeTmp(ev: {
		data: InviteViewModel;
		isSelected: boolean;
		selected: InviteViewModel[];
		source: LocalDataSource;
	}) {
		if (ev.isSelected) {
			this.selectedInvite = ev.data;
			const checkName = this.selectedInvite.fullName.trim();
			this.invitedName = checkName ? checkName : 'Employee / User';
		} else {
			this.selectedInvite = null;
		}
	}

	async invite() {
		const dialog = this.dialogService.open(InviteMutationComponent, {
			context: {
				invitationType: this.invitationType,
				selectedOrganizationId: this.selectedOrganizationId,
				currentUserId: this.store.userId
			}
		});

		await dialog.onClose.pipe(first()).toPromise();

		this.loadPage();
	}

	copyToClipboard() {
		const textField = document.createElement('textarea');
		textField.innerText =
			location.origin + '/#/' + this.selectedInvite.inviteUrl;
		document.body.appendChild(textField);
		textField.select();
		document.execCommand('copy');
		textField.remove();

		this.toastrService.success(
			this.getTranslation('TOASTR.MESSAGE.COPIED'),
			this.getTranslation('TOASTR.TITLE.SUCCESS')
		);
	}

	private async loadPage() {
		this.selectedInvite = null;

		let invites = [];

		try {
			const { items } = await this.inviteService.getAll(
				['projects', 'invitedBy', 'role', 'clients', 'departments'],
				{
					organizationId: this.selectedOrganizationId
				}
			);
			invites = items.filter((invite) => {
				return this.invitationType === InvitationTypeEnum.EMPLOYEE
					? invite.role.name === RolesEnum.EMPLOYEE
					: invite.role.name !== RolesEnum.EMPLOYEE;
			});
		} catch (error) {
			this.toastrService.danger(
				this.getTranslation('TOASTR.MESSAGE.INVITES_LOAD'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		}

		const { name } = this.store.selectedOrganization;

		const invitesVm: InviteViewModel[] = [];

		for (const invite of invites) {
			invitesVm.push({
				email: invite.email,
				expireDate: moment(invite.expireDate).fromNow(),
				imageUrl: invite.invitedBy ? invite.invitedBy.imageUrl : '',
				fullName: `${
					(invite.invitedBy && invite.invitedBy.firstName) || ''
				} ${(invite.invitedBy && invite.invitedBy.lastName) || ''}`,
				roleName: invite.role
					? this.getTranslation(`USERS_PAGE.ROLE.${invite.role.name}`)
					: '',
				status: moment(invite.expireDate).isAfter(moment())
					? this.getTranslation(`INVITE_PAGE.STATUS.${invite.status}`)
					: this.getTranslation(`INVITE_PAGE.STATUS.EXPIRED`),
				projectNames: (invite.projects || []).map(
					(project) => project.name
				),
				clientNames: (invite.clients || []).map(
					(client) => client.name
				),
				departmentNames: (invite.departments || []).map(
					(department) => department.name
				),
				id: invite.id,
				inviteUrl: `auth/accept-invite?email=${invite.email}&token=${invite.token}`
			});
		}

		this.sourceSmartTable.load(invitesVm);

		if (this.employeesTable) {
			this.employeesTable.grid.dataSet.willSelect = 'false';
		}

		this.organizationName = name;

		this.loading = false;
	}

	private _loadSmartTableSettings() {
		const settingsSmartTable = {
			actions: false,
			columns: {
				email: {
					title: this.getTranslation('SM_TABLE.EMAIL'),
					type: 'email'
				},
				roleName: {
					title: this.getTranslation('SM_TABLE.ROLE'),
					type: 'text'
				},
				projects: {
					title: this.getTranslation('SM_TABLE.PROJECTS'),
					type: 'custom',
					renderComponent: ProjectNamesComponent,
					filter: false
				},
				clients: {
					title: this.getTranslation('SM_TABLE.CLIENTS'),
					type: 'custom',
					renderComponent: ClientNamesComponent,
					filter: false
				},
				departments: {
					title: this.getTranslation('SM_TABLE.DEPARTMENTS'),
					type: 'custom',
					renderComponent: DepartmentNamesComponent,
					filter: false
				},
				fullName: {
					title: this.getTranslation('SM_TABLE.INVITED_BY'),
					type: 'text'
				},
				expireDate: {
					title: this.getTranslation('SM_TABLE.EXPIRE_DATE'),
					type: 'text'
				},
				status: {
					title: this.getTranslation('SM_TABLE.STATUS'),
					type: 'text'
				}
			},
			pager: {
				display: true,
				perPage: 8
			}
		};

		if (this.invitationType === InvitationTypeEnum.EMPLOYEE) {
			delete settingsSmartTable['columns']['roleName'];
		}

		if (this.invitationType === InvitationTypeEnum.USER) {
			delete settingsSmartTable['columns']['projects'];
			delete settingsSmartTable['columns']['clients'];
			delete settingsSmartTable['columns']['departments'];
		}
		if (this.invitationType === InvitationTypeEnum.CANDIDATE) {
			delete settingsSmartTable['columns']['projects'];
			delete settingsSmartTable['columns']['clients'];
			delete settingsSmartTable['columns']['roleName'];
		}

		this.settingsSmartTable = settingsSmartTable;
	}

	async deleteInvite() {
		this.dialogService
			.open(DeleteConfirmationComponent, {
				context: {
					recordType:
						this.selectedInvite.email +
						' ' +
						this.getTranslation(
							'FORM.DELETE_CONFIRMATION.INVITATION'
						)
				}
			})
			.onClose.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (result) => {
				if (result) {
					try {
						await this.inviteService.delete(this.selectedInvite.id);

						this.toastrService.primary(
							this.selectedInvite.email + ' has been deleted.',
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

	async resendInvite() {
		this.dialogService
			.open(ResendConfirmationComponent, {
				context: {
					email: this.selectedInvite.email
				}
			})
			.onClose.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (result) => {
				if (result) {
					try {
						await this.inviteService.resendInvite({
							id: this.selectedInvite.id,
							invitedById: this.store.userId
						});

						this.toastrService.primary(
							this.getTranslation(
								'TOASTR.MESSAGE.INVITES_RESEND',
								{ email: this.selectedInvite.email }
							),
							this.getTranslation('TOASTR.TITLE.SUCCESS')
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
