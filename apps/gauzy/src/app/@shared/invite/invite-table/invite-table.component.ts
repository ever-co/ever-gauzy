import { Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { InvitationTypeEnum } from '@gauzy/models';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { LocalDataSource } from 'ng2-smart-table';
import { Subject } from 'rxjs';
import { first, takeUntil } from 'rxjs/operators';
import { ErrorHandlingService } from '../../../@core/services/error-handling.service';
import { InviteService } from '../../../@core/services/invite.service';
import { Store } from '../../../@core/services/store.service';
import { DeleteConfirmationComponent } from '../../user/forms/delete-confirmation/delete-confirmation.component';
import { InviteMutationComponent } from '../invite-mutation/invite-mutation.component';
import { ProjectNamesComponent } from './project-names/project-names.component';
import moment = require('moment-timezone');

interface InviteViewModel {
	email: string;
	expireDate: string;
	imageUrl: string;
	fullName: string;
	roleName?: string;
	status: string;
	projectNames: string[];
	id: string;
	inviteUrl: string;
}

@Component({
	selector: 'ga-invite-table',
	templateUrl: './invite-table.component.html',
	styleUrls: ['./invite-table.component.scss']
})
export class InviteTableComponent implements OnInit, OnDestroy {
	@Input()
	invitationType: InvitationTypeEnum;

	organizationName: string;
	settingsSmartTable: object;
	sourceSmartTable = new LocalDataSource();
	selectedInvite: InviteViewModel;
	selectedOrganizationId: string;

	private _ngDestroy$ = new Subject<void>();

	employeeName = 'Employee';

	loading = true;

	@ViewChild('employeesTable', { static: false }) employeesTable;

	constructor(
		private dialogService: NbDialogService,
		private store: Store,
		private router: Router,
		private toastrService: NbToastrService,
		private route: ActivatedRoute,
		private translate: TranslateService,
		private errorHandler: ErrorHandlingService,
		private inviteService: InviteService
	) {}

	async ngOnInit() {
		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((organization) => {
				if (organization) {
					this.selectedOrganizationId = organization.id;
					this.loadPage();
				}
			});

		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();

		this.route.queryParamMap
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((params) => {
				if (params.get('openAddDialog')) {
					//	this.add();
				}
			});
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
			this.employeeName = checkName ? checkName : 'Employee';
		} else {
			this.selectedInvite = null;
		}
	}

	async invite() {
		const dialog = this.dialogService.open(InviteMutationComponent, {
			context: {
				invitationType: InvitationTypeEnum.EMPLOYEE,
				selectedOrganizationId: this.selectedOrganizationId,
				currentUserId: this.store.userId
			}
		});

		const data = await dialog.onClose.pipe(first()).toPromise();

		console.log('Data', data);
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

	async delete() {
		this.dialogService
			.open(DeleteConfirmationComponent, {
				context: {
					recordType:
						this.selectedInvite.fullName +
						' ' +
						this.getTranslation('FORM.DELETE_CONFIRMATION.EMPLOYEE')
				}
			})
			.onClose.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (result) => {
				if (result) {
					try {
						// await this.employeesService.setEmployeeAsInactive(
						// 	this.selectedInvite.id
						// );

						this.toastrService.primary(
							this.employeeName + ' set as inactive.',
							'Success'
						);

						this.loadPage();
					} catch (error) {
						this.errorHandler.handleError(error);
					}
				}
			});
	}

	private async loadPage() {
		this.selectedInvite = null;

		let invites = [];

		try {
			const { items } = await this.inviteService.getAll(
				['projects', 'invitedBy', 'role'],
				{
					organizationId: this.selectedOrganizationId
				}
			);
			invites = items;
		} catch (error) {
			this.toastrService.warning('Could not load invites');
		}

		const { name } = this.store.selectedOrganization;

		const invitesVm: InviteViewModel[] = [];

		for (const invite of invites) {
			invitesVm.push({
				email: invite.email,
				expireDate: moment(invite.expireDate).fromNow(),
				imageUrl: invite.invitedBy.imageUrl,
				fullName: `${(invite.invitedBy && invite.invitedBy.firstName) ||
					''} ${(invite.invitedBy && invite.invitedBy.lastName) ||
					''}`,
				roleName: invite.role
					? this.getTranslation(`USERS_PAGE.ROLE.${invite.role.name}`)
					: '',
				status: this.getTranslation(
					`INVITE_PAGE.STATUS.${invite.status}`
				),
				projectNames: (invite.projects || []).map(
					(project) => project.name
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

		this.settingsSmartTable = settingsSmartTable;
	}

	getTranslation(prefix: string) {
		let result = '';
		this.translate.get(prefix).subscribe((res) => {
			result = res;
		});
		return result;
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
