import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { IRequestApproval, ComponentLayoutStyleEnum, IOrganization, IApprovalsData } from '@gauzy/contracts';
import { RequestApprovalService, ToastrService } from '@gauzy/ui-sdk/core';
import { LocalDataSource, Cell } from 'angular2-smart-table';
import { combineLatest, firstValueFrom } from 'rxjs';
import { filter, first, tap, debounceTime } from 'rxjs/operators';
import { Subject } from 'rxjs/internal/Subject';
import { NbDialogService } from '@nebular/theme';
import { ComponentEnum, Store, distinctUntilChange } from '@gauzy/ui-sdk/common';
import { ApprovalPolicyComponent } from './table-components/approval-policy/approval-policy.component';
import { RequestApprovalMutationComponent } from '../../@shared/approvals/approvals-mutation.component';
import { PictureNameTagsComponent } from '../../@shared/table-components/picture-name-tags/picture-name-tags.component';
import { RequestApprovalStatusTypesEnum } from '@gauzy/contracts';
import { StatusBadgeComponent } from '../../@shared/status-badge/status-badge.component';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { EmployeeWithLinksComponent, TaskTeamsComponent } from '../../@shared/table-components';
import { pluck } from 'underscore';
import { CreateByComponent } from '../../@shared/table-components/create-by/create-by.component';
import {
	PaginationFilterBaseComponent,
	IPaginationBase
} from '../../@shared/pagination/pagination-filter-base.component';
import { DateViewComponent } from '../../@shared/table-components/date-view/date-view.component';
import { DeleteConfirmationComponent } from '../../@shared/user/forms';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-approvals',
	templateUrl: './approvals.component.html',
	styleUrls: ['./approvals.component.scss']
})
export class ApprovalsComponent extends PaginationFilterBaseComponent implements OnInit, OnDestroy {
	public settingsSmartTable: object;
	public loading: boolean;
	public selectedRequestApproval: IRequestApproval;
	public listApprovals: IApprovalsData[] = [];
	public disableButton = true;
	public smartTableSource = new LocalDataSource();
	public hasEditPermission = false;
	public selectedEmployeeId: string;
	public viewComponentName: ComponentEnum;
	public dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	public componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	public requestApprovalData: IRequestApproval[] = [];
	public organization: IOrganization;
	public _refresh$: Subject<any> = new Subject();

	constructor(
		readonly translateService: TranslateService,
		private approvalRequestService: RequestApprovalService,
		private store: Store,
		private dialogService: NbDialogService,
		private toastrService: ToastrService,
		private router: Router,
		private readonly route: ActivatedRoute
	) {
		super(translateService);
	}

	ngOnInit() {
		this.subject$
			.pipe(
				debounceTime(300),
				tap(() => this.clearItem()),
				tap(() => this.getApprovals()),
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
		combineLatest([this.store.selectedEmployee$, this.store.selectedOrganization$])
			.pipe(
				debounceTime(300),
				filter(([employee, organization]) => !!organization && !!employee),
				distinctUntilChange(),
				tap(([employee, organization]) => {
					this.selectedEmployeeId = employee.id;
					this.organization = organization;
				}),
				tap(() => this._refresh$.next(true)),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.route.queryParamMap
			.pipe(
				filter((params) => !!params && params.get('openAddDialog') === 'true'),
				debounceTime(1000),
				tap(() => this.save(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this._refresh$
			.pipe(
				filter(() => this.isGridLayout),
				tap(() => this.refreshPagination()),
				tap(() => (this.requestApprovalData = [])),
				untilDestroyed(this)
			)
			.subscribe();
		this._applyTranslationOnSmartTable();
		this._loadSmartTableSettings();
		this.setView();
	}

	setView() {
		this.viewComponentName = ComponentEnum.APPROVALS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout) => (this.dataLayoutStyle = componentLayout)),
				tap(() => this.refreshPagination()),
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => (this.requestApprovalData = [])),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	async selectRequestApproval({ isSelected, data }) {
		this.selectedRequestApproval = null;
		this.disableButton = !isSelected;
		setTimeout(() => {
			this.selectedRequestApproval = isSelected ? data : null;
		}, 50);
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
				await this.approvalRequestService.getByEmployeeId(this.selectedEmployeeId, ['requestApprovals'], {
					organizationId,
					tenantId
				})
			).items;
		} else {
			items = (
				await this.approvalRequestService.getAll(
					[
						'employeeApprovals',
						'employeeApprovals.employee',
						'employeeApprovals.employee.user',
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
				status: this.statusMapper(item)
			});
		});
		this.smartTableSource.setPaging(activePage, itemsPerPage, false);
		this.smartTableSource.load(buffersItems);
		if (this.isGridLayout) this._loadGridLayoutData();
		this.setPagination({
			...this.getPagination(),
			totalItems: this.smartTableSource.count()
		});
		this.loading = false;
	}

	private get isGridLayout(): boolean {
		return this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID;
	}

	async _loadGridLayoutData() {
		this.requestApprovalData.push(...(await this.smartTableSource.getElements()));
	}

	async _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.settingsSmartTable = {
			actions: false,
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : this.minItemPerPage
			},
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.APPROVAL_REQUEST'),
			columns: {
				name: {
					title: this.getTranslation('APPROVAL_REQUEST_PAGE.APPROVAL_REQUEST_NAME'),
					type: 'custom',
					renderComponent: PictureNameTagsComponent,
					componentInitFunction: (instance: PictureNameTagsComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					}
				},
				min_count: {
					title: this.getTranslation('APPROVAL_REQUEST_PAGE.APPROVAL_REQUEST_MIN_COUNT'),
					type: 'number',
					filter: false
				},
				approvalPolicy: {
					title: this.getTranslation('APPROVAL_REQUEST_PAGE.APPROVAL_REQUEST_APPROVAL_POLICY'),
					type: 'custom',
					filter: false,
					renderComponent: ApprovalPolicyComponent,
					componentInitFunction: (instance: ApprovalPolicyComponent, cell: Cell) => {
						instance.value = cell.getRawValue();
					}
				},
				createdByName: {
					title: this.getTranslation('APPROVAL_REQUEST_PAGE.CREATED_BY'),
					type: 'custom',
					filter: false,
					renderComponent: CreateByComponent,
					componentInitFunction: (instance: CreateByComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
					}
				},
				createdAt: {
					title: this.getTranslation('APPROVAL_REQUEST_PAGE.CREATED_AT'),
					type: 'custom',
					filter: false,
					renderComponent: DateViewComponent,
					componentInitFunction: (instance: DateViewComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					}
				},
				employees: {
					title: this.getTranslation('APPROVAL_REQUEST_PAGE.EMPLOYEES'),
					type: 'custom',
					filter: false,
					renderComponent: EmployeeWithLinksComponent,
					componentInitFunction: (instance: EmployeeWithLinksComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getRawValue();
					}
				},
				teams: {
					title: this.getTranslation('APPROVAL_REQUEST_PAGE.TEAMS'),
					type: 'custom',
					filter: false,
					renderComponent: TaskTeamsComponent,
					componentInitFunction: (instance: TaskTeamsComponent, cell: Cell) => {
						instance.value = cell.getRawValue();
					}
				},
				status: {
					title: this.getTranslation('APPROVAL_REQUEST_PAGE.APPROVAL_REQUEST_STATUS'),
					type: 'custom',
					width: '5%',
					filter: false,
					renderComponent: StatusBadgeComponent,
					componentInitFunction: (instance: StatusBadgeComponent, cell: Cell) => {
						instance.value = cell.getValue();
					}
				}
			}
		};
	}

	/**
	 * Maps a status value to its corresponding text, value, and CSS class.
	 *
	 * @param row - The row containing the status property.
	 * @returns An object with text, value, and class properties.
	 */
	statusMapper(row: any): { text: string; value: any; class: string } {
		let value;

		// Map status values to their corresponding text
		switch (row.status) {
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

		// Determine the CSS class based on the mapped status text
		const badgeClass = ['approved'].includes(value.toLowerCase())
			? 'success'
			: ['requested'].includes(value.toLowerCase())
			? 'warning'
			: 'danger';

		// Return an object with text, value, and class properties
		return {
			text: value,
			value: row.status,
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
			const request = await this.approvalRequestService.approvalRequestByAdmin(params.data.id);
			if (request) {
				this.toastrService.success('APPROVAL_REQUEST_PAGE.APPROVAL_SUCCESS', { name: params.data.name });
			}
		} else {
			const request = await this.approvalRequestService.refuseRequestByAdmin(params.data.id);
			if (request) {
				this.toastrService.success('APPROVAL_REQUEST_PAGE.REFUSE_SUCCESS', { name: params.data.name });
			}
		}
		this._refresh$.next(true);
		this.subject$.next(true);
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange.pipe(untilDestroyed(this)).subscribe(() => {
			this._refresh$.next(true);
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
		const requestApproval: any = await firstValueFrom(dialog.onClose.pipe(first()));
		if (requestApproval) {
			this.toastrService.success(
				isCreate
					? 'APPROVAL_REQUEST_PAGE.APPROVAL_REQUEST_CREATED'
					: 'APPROVAL_REQUEST_PAGE.APPROVAL_REQUEST_UPDATED',
				{ name: requestApproval.name }
			);
			this._refresh$.next(true);
			this.subject$.next(true);
		}
	}

	async delete(selectedItem?: IRequestApproval) {
		if (selectedItem) {
			this.selectRequestApproval({
				isSelected: true,
				data: selectedItem
			});
		}
		const result = await firstValueFrom(this.dialogService.open(DeleteConfirmationComponent).onClose);
		if (result) {
			const isSuccess = await this.approvalRequestService.delete(this.selectedRequestApproval.id);
			if (isSuccess) {
				this.toastrService.success('APPROVAL_REQUEST_PAGE.APPROVAL_REQUEST_DELETED', {
					name: this.selectedRequestApproval.name
				});
				this._refresh$.next(true);
				this.subject$.next(true);
			}
		}
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
		this.selectRequestApproval({
			isSelected: false,
			data: null
		});
	}

	ngOnDestroy() {}
}
