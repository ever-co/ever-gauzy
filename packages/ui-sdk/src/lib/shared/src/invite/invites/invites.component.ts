import { AfterViewInit, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Router, UrlSerializer } from '@angular/router';
import { Location } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { Cell } from 'angular2-smart-table';
import { Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import moment from 'moment';
import { ClipboardService, IClipboardResponse } from 'ngx-clipboard';
import { InviteService, ServerDataSource, ToastrService } from '@gauzy/ui-sdk/core';
import {
	InvitationTypeEnum,
	RolesEnum,
	ComponentLayoutStyleEnum,
	IOrganization,
	IInviteViewModel,
	InvitationExpirationEnum,
	IInvite,
	InviteStatusEnum
} from '@gauzy/contracts';
import { API_PREFIX, ComponentEnum, Store, distinctUntilChange } from '@gauzy/ui-sdk/common';
import {
	IPaginationBase,
	PaginationFilterBaseComponent
} from '../../smart-table/pagination/pagination-filter-base.component';
import { DateViewComponent } from '../../table-components';
import { DeleteConfirmationComponent } from '../../user/forms/delete-confirmation/delete-confirmation.component';
import { InviteMutationComponent } from '../invite-mutation/invite-mutation.component';
import { ProjectNamesComponent } from './project-names/project-names.component';
import { ResendConfirmationComponent } from './resend-confirmation/resend-confirmation.component';
import { ClientNamesComponent } from './client-names/client-names.component';
import { DepartmentNamesComponent } from './department-names/department-names.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-invites',
	templateUrl: './invites.component.html',
	styleUrls: ['invites.component.scss']
})
export class InvitesComponent extends PaginationFilterBaseComponent implements AfterViewInit, OnInit, OnDestroy {
	public InviteStatusEnum: typeof InviteStatusEnum = InviteStatusEnum;

	/*
	 * Getter & Setter for InvitationTypeEnum
	 */
	private _invitationType: InvitationTypeEnum;
	get invitationType(): InvitationTypeEnum {
		return this._invitationType;
	}
	@Input() set invitationType(value: InvitationTypeEnum) {
		this._invitationType = value;
	}

	public loading: boolean = false;
	public disableButton: boolean = true;
	public settingsSmartTable: object;
	public smartTableSource: ServerDataSource;
	public selectedInvite: IInviteViewModel;
	public viewComponentName: ComponentEnum;
	public dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	public componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	public invites: IInviteViewModel[] = [];
	public invites$: Subject<any> = new Subject();
	public organization: IOrganization;
	private _refresh$: Subject<any> = new Subject();

	constructor(
		private readonly dialogService: NbDialogService,
		private readonly clipboardService: ClipboardService,
		private readonly router: Router,
		private readonly _location: Location,
		private readonly _urlSerializer: UrlSerializer,
		private readonly store: Store,
		private readonly toastrService: ToastrService,
		private readonly translate: TranslateService,
		private readonly inviteService: InviteService,
		private readonly httpClient: HttpClient
	) {
		super(translate);
		this.setView();

		/**
		 * Destroyed textarea element after each copy to clipboard
		 */
		clipboardService.configure({ cleanUpAfterCopy: true });
	}

	ngOnInit(): void {
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();
	}

	ngAfterViewInit(): void {
		this.clipboardService.copyResponse$
			.pipe(
				filter((clipboard: IClipboardResponse) => !!clipboard.isSuccess),
				tap((clipboard: IClipboardResponse) => this.onCopySuccess(clipboard))
			)
			.subscribe();
		this.invites$
			.pipe(
				debounceTime(200),
				tap(() => this.clearItem()),
				tap(() => this.getInvites()),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this.invites$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this._refresh$.next(true)),
				tap(() => this.invites$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this._refresh$
			.pipe(
				filter(() => this.dataLayoutStyle === this.componentLayoutStyleEnum.CARDS_GRID),
				tap(() => this.refreshPagination()),
				tap(() => (this.invites = [])),
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
				distinctUntilChange(),
				tap(() => this.refreshPagination()),
				tap((componentLayout) => (this.dataLayoutStyle = componentLayout)),
				tap(() => (this.invites = [])),
				tap(() => this.invites$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	selectInvite({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedInvite = isSelected ? data : null;
	}

	invite(): void {
		this.dialogService
			.open(InviteMutationComponent, {
				context: {
					invitationType: this.invitationType
				}
			})
			.onClose.pipe(
				filter((invite: IInvite) => !!invite),
				tap(() => this._refresh$.next(true)),
				tap(() => this.invites$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	async copyToClipboard(selectedItem?: IInviteViewModel) {
		if (selectedItem) {
			this.selectInvite({
				isSelected: true,
				data: selectedItem
			});
		}
		if (this.selectedInvite) {
			const { email, token } = this.selectedInvite;
			// The call to Location.prepareExternalUrl is the key thing here.
			let tree = this.router.createUrlTree([`auth/accept-invite`], {
				queryParams: {
					email: email,
					token: token
				}
			});
			this.clipboardService.copy(
				[location.origin, this._location.prepareExternalUrl(this._urlSerializer.serialize(tree))].join('/')
			);
		}
	}

	/**
	 * Copy Success
	 *
	 * @param clipboard
	 */
	onCopySuccess(clipboard: IClipboardResponse) {
		try {
			this.toastrService.success('TOASTR.MESSAGE.COPIED');
		} finally {
			this.clearItem();
		}
	}

	/**
	 * Copy Failure
	 *
	 * @param clipboard
	 */
	onCopyFailure(clipboard: IClipboardResponse) {}

	/*
	 * Register Smart Table Source Config
	 */
	setSmartTableSource() {
		if (!this.organization) {
			return;
		}
		// this.loading = true;
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		this.smartTableSource = new ServerDataSource(this.httpClient, {
			endPoint: `${API_PREFIX}/invite`,
			relations: ['projects', 'invitedBy', 'role', 'organizationContacts', 'departments'],
			where: {
				organizationId,
				tenantId,
				...(this.invitationType === InvitationTypeEnum.EMPLOYEE
					? {
							role: {
								name: RolesEnum.EMPLOYEE
							}
					  }
					: {}),
				...(this.invitationType === InvitationTypeEnum.CANDIDATE
					? {
							role: {
								name: RolesEnum.CANDIDATE
							}
					  }
					: {})
			},
			resultMap: (invite: IInvite) => {
				return Object.assign({}, invite, {
					email: invite.email,
					expireDate: invite.expireDate
						? moment(invite.expireDate).fromNow()
						: InvitationExpirationEnum.NEVER,
					createdDate: invite.createdAt,
					imageUrl: invite.invitedBy ? invite.invitedBy.imageUrl : '',
					fullName: invite.invitedBy ? invite.invitedBy.name : '',
					roleName: invite.role ? invite.role.name : '',
					projectNames: (invite.projects || []).map((project) => project.name),
					clientNames: (invite.organizationContacts || []).map(
						(organizationContact) => organizationContact.name
					),
					departmentNames: (invite.departments || []).map((department) => department.name),
					id: invite.id,
					token: invite.token
				});
			},
			finalize: () => {
				this.setPagination({
					...this.getPagination(),
					totalItems: this.smartTableSource.count()
				});
				this.loading = false;
			}
		});
	}

	/***
	 * GET invites
	 *
	 */
	private async getInvites() {
		if (!this.organization) {
			return;
		}
		try {
			this.setSmartTableSource();

			const { activePage, itemsPerPage } = this.getPagination();
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);
			if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {
				await this.smartTableSource.getElements();
				await this._loadGridLayoutData();
			}
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	/***
	 * GET invites for GRID layout
	 *
	 */
	private async _loadGridLayoutData() {
		this.invites.push(...this.smartTableSource.getData());
	}

	/**
	 * Load smart table settings
	 */
	private _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		const settingsSmartTable = {
			actions: false,
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.INVITE'),
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
					filter: false,
					renderComponent: ProjectNamesComponent,
					componentInitFunction: (instance: ProjectNamesComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
					}
				},
				contact: {
					title: this.getTranslation('SM_TABLE.CONTACTS'),
					type: 'custom',
					filter: false,
					renderComponent: ClientNamesComponent,
					componentInitFunction: (instance: ClientNamesComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
					}
				},
				departments: {
					title: this.getTranslation('SM_TABLE.DEPARTMENTS'),
					type: 'custom',
					filter: false,
					renderComponent: DepartmentNamesComponent,
					componentInitFunction: (instance: DepartmentNamesComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
					}
				},
				fullName: {
					title: this.getTranslation('SM_TABLE.INVITED_BY'),
					type: 'text'
				},
				createdDate: {
					title: this.getTranslation('SM_TABLE.CREATED'),
					type: 'custom',
					filter: false,
					renderComponent: DateViewComponent,
					componentInitFunction: (instance: DateViewComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					}
				},
				expireDate: {
					title: this.getTranslation('SM_TABLE.EXPIRE_DATE'),
					type: 'text'
				},
				status: {
					title: this.getTranslation('SM_TABLE.STATUS'),
					type: 'text'
				}
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
						this.selectedInvite.email + ' ' + this.getTranslation('FORM.DELETE_CONFIRMATION.INVITATION')
				}
			})
			.onClose.pipe(untilDestroyed(this))
			.subscribe(async (result) => {
				if (result) {
					try {
						if (!this.selectedInvite) {
							this.toastrService.danger('Invitation is not selected');
							return;
						}
						const { id, email } = this.selectedInvite;
						await this.inviteService
							.delete(id)
							.then(() => {
								this.toastrService.success('TOASTR.MESSAGE.INVITES_DELETE', {
									email: email
								});
							})
							.finally(() => {
								this._refresh$.next(true);
								this.invites$.next(true);
							});
					} catch (error) {
						this.toastrService.danger(error.error.message || error.message);
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
		if (this.selectedInvite.status !== InviteStatusEnum.INVITED) {
			return;
		}
		this.dialogService
			.open(ResendConfirmationComponent, {
				context: {
					email: this.selectedInvite.email
				}
			})
			.onClose.pipe(untilDestroyed(this))
			.subscribe(async (result) => {
				if (result) {
					try {
						if (!this.selectedInvite) {
							this.toastrService.danger('Invitation is not selected');
							return;
						}
						const { id, email, organizationId } = this.selectedInvite;
						await this.inviteService
							.resendInvite({
								inviteId: id,
								inviteType: this.invitationType,
								organizationId
							})
							.then(() => {
								this.toastrService.success('TOASTR.MESSAGE.INVITES_RESEND', {
									email
								});
							})
							.finally(() => {
								this._refresh$.next(true);
								this.invites$.next(true);
							});
					} catch (error) {
						this.toastrService.danger(error);
					}
				}
			});
	}

	getSelectedPersonRole = () => {
		if (this.isEmployeeInvitation()) {
			return RolesEnum.EMPLOYEE;
		}
		if (this.isCandidateInvitation()) {
			return RolesEnum.CANDIDATE;
		}
	};

	isEmployeeInvitation() {
		return this.selectedInvite.roleName === InvitationTypeEnum.EMPLOYEE;
	}

	isCandidateInvitation() {
		return this.selectedInvite.roleName === InvitationTypeEnum.CANDIDATE;
	}

	private _applyTranslationOnSmartTable() {
		this.translate.onLangChange
			.pipe(
				tap(() => this._loadSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
		this.selectInvite({
			isSelected: false,
			data: null
		});
	}
}
