import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { Router, RouterEvent, NavigationEnd } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import {
	IRequestApproval,
	ComponentLayoutStyleEnum,
	IOrganization,
	IApprovalsData
} from '@gauzy/contracts';
import { RequestApprovalService } from '../../@core/services/request-approval.service';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { firstValueFrom } from 'rxjs';
import { filter, first, tap, debounceTime } from 'rxjs/operators';
import { NbDialogService } from '@nebular/theme';
import { Store } from '../../@core/services/store.service';
import { ApprovalPolicyComponent } from './table-components/approval-policy/approval-policy.component';
import { RequestApprovalMutationComponent } from '../../@shared/approvals/approvals-mutation.component';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import { PictureNameTagsComponent } from '../../@shared/table-components/picture-name-tags/picture-name-tags.component';
import { RequestApprovalStatusTypesEnum } from '@gauzy/contracts';
import { StatusBadgeComponent } from '../../@shared/status-badge/status-badge.component';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ToastrService } from '../../@core/services/toastr.service';
import {
	EmployeeWithLinksComponent,
	TaskTeamsComponent
} from '../../@shared/table-components';
import { pluck } from 'underscore';
import { CreateByComponent } from '../../@shared/table-components/create-by/create-by.component';
import {
	PaginationFilterBaseComponent,
	IPaginationBase
} from '../../@shared/pagination/pagination-filter-base.component';
import { distinctUntilChange } from '../../../../../../packages/common-angular/src/utils/shared-utils';
import { Subject } from 'rxjs/internal/Subject';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-approvals',
	templateUrl: './approvals.component.html',
	styleUrls: ['./approvals.component.scss']
})
export class ApprovalsComponent
	extends PaginationFilterBaseComponent
	implements OnInit, OnDestroy
{
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
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	requestApprovalData: IRequestApproval[];
	organization: IOrganization;
	subject$: Subject<any> = new Subject();

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
		private toastrService: ToastrService,
		private router: Router
	) {
		super(translateService);
	}

	ngOnInit() {
		this.subject$
			.pipe(
				debounceTime(300),
				tap(() => this.getApprovals()),
				tap(() => this.clearItem()),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedEmployee$
			.pipe(
				filter((employee) => !!employee),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe((employee) => {
				if (employee && employee.id) {
					this.selectedEmployeeId = employee.id;
				}
			});
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe((org) => {
				if (org) {
					this.organization = org;
				}
			});
		this.router.events
			.pipe(untilDestroyed(this))
			.subscribe((event: RouterEvent) => {
				if (event instanceof NavigationEnd) {
					this.setView();
				}
			});
		this._applyTranslationOnSmartTable();
		this._loadSmartTableSettings();
		this.setView();
	}

	setView() {
		this.viewComponentName = ComponentEnum.APPROVALS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				tap(() => this.subject$.next(true)),
				tap(() => this.refreshPagination()),
				untilDestroyed(this)
			)
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

	async getApprovals() {
		if (!this.organization) {
			return;
		}
		this.loading = true;
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const { activePage, itemsPerPage } = this.getPagination();
		const buffersItems: any[] = [];
		let items: any = [];
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
					[
						'employeeApprovals',
						'employeeApprovals.employee',
						'employee.user',
						'teamApprovals',
						'teamApprovals.team',
						'tags'
					],
					{ organizationId, tenantId }
				)
			).items;

			if (items.length > 0) {
				items.filter((item) => {
					item.employees = pluck(item.employeeApprovals, 'employee');
					item.teams = pluck(item.teamApprovals, 'team');
					return item;
				});
			}
		}
		items.map((item: any) => {
			buffersItems.push({
				...item,
				status: this.statusMapper(item.status)
			});
		});
		this.smartTableSource.setPaging(activePage, itemsPerPage, false);
		this.requestApprovalData = buffersItems;
		this.smartTableSource.load(this.requestApprovalData);
		if (this.dataLayoutStyle === this.componentLayoutStyleEnum.CARDS_GRID)
			this._loadGridLayoutData();
		this.setPagination({
			...this.getPagination(),
			totalItems: this.smartTableSource.count()
		});
		this.loading = false;
	}

	async _loadGridLayoutData() {
		this.requestApprovalData = await this.smartTableSource.getElements();
	}

	async _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.settingsSmartTable = {
			actions: false,
			pager: {
				display: false,
				perPage: pagination ? pagination : 10
			},
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
					type: 'custom',
					renderComponent: CreateByComponent,
					filter: false
				},
				employees: {
					title: this.getTranslation(
						'APPROVAL_REQUEST_PAGE.EMPLOYEES'
					),
					type: 'custom',
					filter: false,
					renderComponent: EmployeeWithLinksComponent
				},
				teams: {
					title: this.getTranslation('APPROVAL_REQUEST_PAGE.TEAMS'),
					type: 'custom',
					filter: false,
					renderComponent: TaskTeamsComponent
				},
				status: {
					title: this.getTranslation(
						'APPROVAL_REQUEST_PAGE.APPROVAL_REQUEST_STATUS'
					),
					type: 'custom',
					width: '5%',
					renderComponent: StatusBadgeComponent,
					filter: false
				}
			}
		};
	}

	statusMapper(value: any) {
		switch (value) {
			case RequestApprovalStatusTypesEnum.APPROVED:
				value = this.getTranslation('APPROVAL_REQUEST_PAGE.APPROVED');
				break;
			case RequestApprovalStatusTypesEnum.REFUSED:
				value = this.getTranslation('APPROVAL_REQUEST_PAGE.REFUSED');
				break;
			default:
				value = this.getTranslation('APPROVAL_REQUEST_PAGE.REQUESTED');
				break;
		}
		const badgeClass = ['approved'].includes(value.toLowerCase())
			? 'success'
			: ['requested'].includes(value.toLowerCase())
			? 'warning'
			: 'danger';
		return {
			text: value,
			class: badgeClass
		};
	}

	onUpdateResult(params) {
		this.handleEvent(params);
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
			const request =
				await this.approvalRequestService.approvalRequestByAdmin(
					params.data.id
				);
			if (request) {
				this.toastrService.success(
					'APPROVAL_REQUEST_PAGE.APPROVAL_SUCCESS',
					{ name: params.data.name }
				);
			}
		} else {
			const request =
				await this.approvalRequestService.refuseRequestByAdmin(
					params.data.id
				);
			if (request) {
				this.toastrService.success(
					'APPROVAL_REQUEST_PAGE.REFUSE_SUCCESS',
					{ name: params.data.name }
				);
			}
		}
		this.clearItem();
		this.getApprovals();
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.subject$.next(true);
			});
	}

	manageApprovalPolicy() {
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
		const requestApproval: any = await firstValueFrom(
			dialog.onClose.pipe(first())
		);
		if (requestApproval) {
			this.toastrService.success(
				isCreate
					? 'APPROVAL_REQUEST_PAGE.APPROVAL_REQUEST_CREATED'
					: 'APPROVAL_REQUEST_PAGE.APPROVAL_REQUEST_UPDATED',
				{ name: requestApproval.name }
			);
			this.clearItem();
			this.getApprovals();
		}
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
			this.toastrService.success(
				'APPROVAL_REQUEST_PAGE.APPROVAL_REQUEST_DELETED',
				{ name: this.selectedRequestApproval.name }
			);
		}
		this.clearItem();
		this.getApprovals();
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
