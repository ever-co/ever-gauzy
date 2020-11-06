import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { Router, RouterEvent, NavigationEnd } from '@angular/router';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import {
	IRequestApproval,
	ComponentLayoutStyleEnum,
	IOrganization,
	IRolePermission,
	IApprovalsData
} from '@gauzy/models';
import { RequestApprovalService } from '../../@core/services/request-approval.service';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { filter, first, tap } from 'rxjs/operators';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { Store } from '../../@core/services/store.service';
import { ApprovalPolicyComponent } from './table-components/approval-policy/approval-policy.component';
import { RequestApprovalMutationComponent } from '../../@shared/approvals/approvals-mutation.component';
import { RequestApprovalActionComponent } from './table-components/request-approval-action/request-approval-action.component';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import { PictureNameTagsComponent } from '../../@shared/table-components/picture-name-tags/picture-name-tags.component';
import { RequestApprovalStatusTypesEnum } from '@gauzy/models';
import { StatusBadgeComponent } from '../../@shared/status-badge/status-badge.component';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NgxPermissionsService } from 'ngx-permissions';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-approvals',
	templateUrl: './approvals.component.html',
	styleUrls: ['./approvals.component.scss']
})
export class ApprovalsComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	public settingsSmartTable: object;
	public loading: boolean;
	public selectedRequestApproval: IRequestApproval;
	public listApprovals: IApprovalsData[] = [];
	public disableButton = true;
	public smartTableSource = new LocalDataSource();
	public hasEditPermission = false;
	public selectedEmployeeId: string;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	requestApprovalData: IRequestApproval[];
	organization: IOrganization;

	requestApprovalTable: Ng2SmartTableComponent;
	@ViewChild('requestApprovalTable') set content(
		content: Ng2SmartTableComponent
	) {
		if (content) {
			this.requestApprovalTable = content;
			this.onChangedSource();
		}
	}

	constructor(
		readonly translateService: TranslateService,
		private approvalRequestService: RequestApprovalService,
		private store: Store,
		private dialogService: NbDialogService,
		private toastrService: NbToastrService,
		private router: Router,
		private permissionsService: NgxPermissionsService
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this.store.userRolePermissions$
			.pipe(
				filter(
					(permissions: IRolePermission[]) => permissions.length > 0
				),
				untilDestroyed(this)
			)
			.subscribe((data) => {
				const permissions = data.map(
					(permisson) => permisson.permission
				);
				this.permissionsService.loadPermissions(permissions);
			});
		this.store.selectedEmployee$
			.pipe(
				filter((employee) => !!employee),
				untilDestroyed(this)
			)
			.subscribe((employee) => {
				if (employee && employee.id) {
					this.selectedEmployeeId = employee.id;
					this.loadSettings();
				}
			});
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe((org) => {
				if (org) {
					this.organization = org;
					this.loadSettings();
				}
			});
		this.router.events
			.pipe(untilDestroyed(this))
			.subscribe((event: RouterEvent) => {
				if (event instanceof NavigationEnd) {
					this.setView();
				}
			});
		this.loadSmartTable();
		this._applyTranslationOnSmartTable();
	}

	setView() {
		this.viewComponentName = ComponentEnum.APPROVALS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(untilDestroyed(this))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
			});
	}

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.requestApprovalTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this.clearItem())
			)
			.subscribe();
	}

	async selectRequestApproval({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedRequestApproval = isSelected ? data : null;
	}

	async loadSettings() {
		if (!this.organization) {
			return;
		}
		this.loading = true;
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		let items = [];
		if (this.selectedEmployeeId) {
			items = (
				await this.approvalRequestService.getByEmployeeId(
					this.selectedEmployeeId,
					['requestApprovals'],
					{ organizationId, tenantId }
				)
			).items;
		} else {
			items = (
				await this.approvalRequestService.getAll(
					['employeeApprovals', 'teamApprovals', 'tags'],
					{ organizationId, tenantId }
				)
			).items;
		}

		this.loading = false;
		this.requestApprovalData = items;
		this.smartTableSource.load(items);
	}

	async loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				name: {
					title: this.getTranslation(
						'APPROVAL_REQUEST_PAGE.APPROVAL_REQUEST_NAME'
					),
					type: 'custom',
					renderComponent: PictureNameTagsComponent
				},
				min_count: {
					title: this.getTranslation(
						'APPROVAL_REQUEST_PAGE.APPROVAL_REQUEST_MIN_COUNT'
					),
					type: 'number',
					filter: false
				},
				approvalPolicy: {
					title: this.getTranslation(
						'APPROVAL_REQUEST_PAGE.APPROVAL_REQUEST_APPROVAL_POLICY'
					),
					type: 'custom',
					renderComponent: ApprovalPolicyComponent,
					filter: false
				},
				createdByName: {
					title: this.getTranslation(
						'APPROVAL_REQUEST_PAGE.CREATED_BY'
					),
					type: 'string',
					filter: false
				},
				status: {
					title: this.getTranslation(
						'APPROVAL_REQUEST_PAGE.APPROVAL_REQUEST_STATUS'
					),
					type: 'custom',
					renderComponent: StatusBadgeComponent,
					valuePrepareFunction: (cell, row) => {
						switch (cell) {
							case RequestApprovalStatusTypesEnum.APPROVED:
								cell = 'Approved';
								break;
							case RequestApprovalStatusTypesEnum.REFUSED:
								cell = 'Refused';
								break;
							default:
								cell = 'Requested';
								break;
						}
						const badgeClass = ['approved'].includes(
							cell.toLowerCase()
						)
							? 'success'
							: ['requested'].includes(cell.toLowerCase())
							? 'warning'
							: 'danger';
						return {
							text: cell,
							class: badgeClass
						};
					},
					filter: false
				},
				actions: {
					title: this.getTranslation(
						'APPROVAL_REQUEST_PAGE.APPROVAL_REQUEST_ACTIONS'
					),
					type: 'custom',
					renderComponent: RequestApprovalActionComponent,
					onComponentInitFunction: (instance) => {
						instance.updateResult
							.pipe(untilDestroyed(this))
							.subscribe((params) => {
								this.handleEvent(params);
							});
					},
					filter: false
				}
			}
		};
	}

	approval(rowData) {
		const params = {
			isApproval: true,
			data: rowData
		};
		this.handleEvent(params);
	}
	refuse(rowData) {
		const params = {
			isApproval: false,
			data: rowData
		};
		this.handleEvent(params);
	}

	async handleEvent(params: any) {
		if (!this.organization) {
			return;
		}
		if (params.isApproval) {
			const request = await this.approvalRequestService.approvalRequestByAdmin(
				params.data.id
			);
			if (request) {
				this.toastrService.primary(
					this.getTranslation(
						'APPROVAL_REQUEST_PAGE.APPROVAL_SUCCESS'
					),
					this.getTranslation('TOASTR.TITLE.SUCCESS')
				);
			}
		} else {
			const request = await this.approvalRequestService.refuseRequestByAdmin(
				params.data.id
			);
			if (request) {
				this.toastrService.primary(
					this.getTranslation('APPROVAL_REQUEST_PAGE.REFUSE_SUCCESS'),
					this.getTranslation('TOASTR.TITLE.SUCCESS')
				);
			}
		}
		this.clearItem();
		this.loadSettings();
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.loadSmartTable();
			});
	}

	manageAppropvalPolicy() {
		this.router.navigate(['/pages/organization/approval-policy']);
	}

	async save(isCreate: boolean, selectedItem?: IRequestApproval) {
		let dialog;
		if (selectedItem) {
			this.selectRequestApproval({
				isSelected: true,
				data: selectedItem
			});
		}
		if (!isCreate) {
			dialog = this.dialogService.open(RequestApprovalMutationComponent, {
				context: {
					requestApproval: this.selectedRequestApproval
				}
			});
		} else {
			dialog = this.dialogService.open(RequestApprovalMutationComponent);
		}
		const requestApproval = await dialog.onClose.pipe(first()).toPromise();
		if (requestApproval) {
			this.toastrService.primary(
				this.getTranslation(
					'APPROVAL_REQUEST_PAGE.APPROVAL_REQUEST_SAVED'
				),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		}
		this.clearItem();
		this.loadSettings();
	}

	async delete(selectedItem?: IRequestApproval) {
		if (selectedItem) {
			this.selectRequestApproval({
				isSelected: true,
				data: selectedItem
			});
		}
		const isSuccess = await this.approvalRequestService.delete(
			this.selectedRequestApproval.id
		);
		if (isSuccess) {
			this.toastrService.primary(
				this.getTranslation(
					'APPROVAL_REQUEST_PAGE.APPROVAL_REQUEST_DELETED'
				),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		}
		this.clearItem();
		this.loadSettings();
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
		this.selectRequestApproval({
			isSelected: false,
			data: null
		});
		this.deselectAll();
	}

	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.requestApprovalTable && this.requestApprovalTable.grid) {
			this.requestApprovalTable.grid.dataSet['willSelect'] = 'false';
			this.requestApprovalTable.grid.dataSet.deselectAll();
		}
	}

	ngOnDestroy() {}
}
