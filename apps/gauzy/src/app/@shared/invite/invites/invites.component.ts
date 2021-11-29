import { AfterViewInit, Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {
	InvitationTypeEnum,
	RolesEnum,
	ComponentLayoutStyleEnum,
	IOrganization,
	IInviteViewModel
} from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { Subject, firstValueFrom } from 'rxjs';
import * as moment from 'moment-timezone';
import { InviteService, Store, ToastrService } from '../../../@core/services';
import { DeleteConfirmationComponent } from '../../user/forms';
import { InviteMutationComponent } from '../invite-mutation/invite-mutation.component';
import { ProjectNamesComponent } from './project-names/project-names.component';
import { ResendConfirmationComponent } from './resend-confirmation/resend-confirmation.component';
import { ClientNamesComponent } from './client-names/client-names.component';
import { DepartmentNamesComponent } from './department-names/department-names.component';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { ComponentEnum } from '../../../@core/constants';
import { DateViewComponent } from '../../table-components';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-invites',
	templateUrl: './invites.component.html',
	styleUrls: ['invites.component.scss']
})
export class InvitesComponent
	extends TranslationBaseComponent
	implements AfterViewInit, OnInit, OnDestroy {

	@Input()
	invitationType: InvitationTypeEnum;

	settingsSmartTable: object;
	sourceSmartTable = new LocalDataSource();
	selectedInvite: IInviteViewModel;
	viewComponentName: ComponentEnum;
	disableButton = true;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	invites: IInviteViewModel[] = [];
	loading: boolean;

	invites$: Subject<any> = new Subject();
	public organization: IOrganization;

	invitesTable: Ng2SmartTableComponent;
	@ViewChild('invitesTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.invitesTable = content;
			this.onChangedSource();
		}
	}

	constructor(
		private readonly dialogService: NbDialogService,
		private readonly store: Store,
		private readonly toastrService: ToastrService,
		private readonly translate: TranslateService,
		private readonly inviteService: InviteService
	) {
		super(translate);
		this.setView();
	}

	ngOnInit() {
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();
		this.invites$
			.pipe(
				debounceTime(200),
				tap(() => this.loading = true),
				tap(() => this.loadInvites()),
				tap(() => this.clearItem()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => this.organization = organization),
				tap(() => this.invites$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy(): void {}

	setView() {
		this.viewComponentName = ComponentEnum.MANAGE_INVITES;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				tap((componentLayout) => this.dataLayoutStyle = componentLayout),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.invitesTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this.clearItem())
			)
			.subscribe();
	}

	selectInvite({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedInvite = isSelected ? data : null;
	}

	async invite() {
		const dialog = this.dialogService.open(InviteMutationComponent, {
			context: {
				invitationType: this.invitationType
			}
		});
		await firstValueFrom(dialog.onClose);
		this.loadInvites();
	}

	copyToClipboard(selectedItem?: IInviteViewModel) {
		if (selectedItem) {
			this.selectInvite({
				isSelected: true,
				data: selectedItem
			});
		}
		const textField = document.createElement('textarea');
		textField.innerText =
			location.origin + '/#/' + this.selectedInvite.inviteUrl;
		document.body.appendChild(textField);
		textField.select();
		document.execCommand('copy');
		textField.remove();

		this.toastrService.success('TOASTR.MESSAGE.COPIED');
		this.clearItem();
	}

	private async loadInvites() {
		let invites = [];
		try {
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;

			const { items } = await this.inviteService.getAll(
				[ 'projects', 'invitedBy', 'role', 'organizationContact', 'departments' ],
				{ organizationId, tenantId }
			);
			invites = items.filter((invite) => {
				if(this.invitationType === InvitationTypeEnum.EMPLOYEE) {
					return invite.role.name == RolesEnum.EMPLOYEE;
				} else if (this.invitationType === InvitationTypeEnum.CANDIDATE) {
					return invite.role.name === RolesEnum.CANDIDATE;
				} else {
					return invite.role.name !== RolesEnum.EMPLOYEE;
				}
			});
		} catch (error) {
			this.toastrService.danger('TOASTR.MESSAGE.INVITES_LOAD');
		}

		const invitesVm: IInviteViewModel[] = [];
		for (const invite of invites) {
			invitesVm.push({
				email: invite.email,
				expireDate: invite.expireDate ? moment(invite.expireDate).fromNow() : null,
				createdDate: invite.createdAt,
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
				clientNames: (invite.organizationContact || []).map(
					(organizationContact) => organizationContact.name
				),
				departmentNames: (invite.departments || []).map(
					(department) => department.name
				),
				id: invite.id,
				inviteUrl: `auth/accept-invite?email=${invite.email}&token=${invite.token}`
			});
		}
		this.invites = invitesVm;
		this.sourceSmartTable.load(invitesVm);
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
				contact: {
					title: this.getTranslation('SM_TABLE.CONTACTS'),
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
				createdDate: {
					title: this.getTranslation('SM_TABLE.CREATED'),
					type: 'custom',
					renderComponent: DateViewComponent,
					filter: false
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
			delete settingsSmartTable['columns']['contact'];
			delete settingsSmartTable['columns']['departments'];
		}
		if (this.invitationType === InvitationTypeEnum.CANDIDATE) {
			delete settingsSmartTable['columns']['projects'];
			delete settingsSmartTable['columns']['contact'];
			delete settingsSmartTable['columns']['roleName'];
		}
		this.settingsSmartTable = settingsSmartTable;
	}

	async deleteInvite(selectedItem?: IInviteViewModel) {
		if (selectedItem) {
			this.selectInvite({
				isSelected: true,
				data: selectedItem
			});
		}
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
			.onClose
			.pipe(untilDestroyed(this))
			.subscribe(async (result) => {
				if (result) {
					try {
						if (!this.selectedInvite) {
							this.toastrService.danger('Invitation is not selected');
							return;
						}
						const { id, email } = this.selectedInvite;
						await this.inviteService.delete(id)
							.then(() => {
								this.toastrService.success('TOASTR.MESSAGE.INVITES_DELETE', {
									email: email
								});
							})
							.finally(() => {
								this.invites$.next(true);
							});
					} catch (error) {
						this.toastrService.danger(
							error.error.message || error.message
						);
					}
				}
			});
	}

	async resendInvite(selectedItem?: IInviteViewModel) {
		if (selectedItem) {
			this.selectInvite({
				isSelected: true,
				data: selectedItem
			});
		}
		this.dialogService
			.open(ResendConfirmationComponent, {
				context: {
					email: this.selectedInvite.email
				}
			})
			.onClose
			.pipe(untilDestroyed(this))
			.subscribe(async (result) => {
				if (result) {
					try {
						if (!this.selectedInvite) {
							this.toastrService.danger('Invitation is not selected');
							return;
						}

						const { id, email } = this.selectedInvite;
						await this.inviteService.resendInvite({
							id,
							invitedById: this.store.userId
						}).then(() => {
							this.toastrService.success('TOASTR.MESSAGE.INVITES_RESEND', {
								email
							});
						})
						.finally(() => {
							this.invites$.next(true);
						});
					} catch (error) {
						this.toastrService.danger(error);
					}
				}
			});
	}

	private _applyTranslationOnSmartTable() {
		this.translate.onLangChange
			.pipe(
				tap(() => this._loadSmartTableSettings()),
				untilDestroyed(this)
			).subscribe();
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
		this.selectInvite({
			isSelected: false,
			data: null
		});
		this.deselectAll();
	}

	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.invitesTable && this.invitesTable.grid) {
			this.invitesTable.grid.dataSet['willSelect'] = 'false';
			this.invitesTable.grid.dataSet.deselectAll();
		}
	}
}
