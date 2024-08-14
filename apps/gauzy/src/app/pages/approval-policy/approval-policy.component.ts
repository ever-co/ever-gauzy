import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { filter, tap, debounceTime } from 'rxjs/operators';
import { Subject, firstValueFrom } from 'rxjs';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ApprovalPolicyService, ServerDataSource, ToastrService } from '@gauzy/ui-core/core';
import { IApprovalPolicy, ComponentLayoutStyleEnum, IOrganization } from '@gauzy/contracts';
import { API_PREFIX, ComponentEnum, Store, distinctUntilChange } from '@gauzy/ui-core/common';
import {
	ApprovalPolicyMutationComponent,
	DeleteConfirmationComponent,
	IPaginationBase,
	InputFilterComponent,
	PaginationFilterBaseComponent
} from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-approval-policy',
	templateUrl: './approval-policy.component.html',
	styleUrls: ['./approval-policy.component.scss']
})
export class ApprovalPolicyComponent extends PaginationFilterBaseComponent implements AfterViewInit, OnInit, OnDestroy {
	public settingsSmartTable: object;

	public loading: boolean = false;
	public disableButton: boolean = true;

	public selectedApprovalPolicy: IApprovalPolicy;
	public smartTableSource: ServerDataSource;
	public approvalPolicies: IApprovalPolicy[] = [];

	public viewComponentName: ComponentEnum = ComponentEnum.APPROVAL_POLICY;
	public dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	public componentLayoutStyleEnum = ComponentLayoutStyleEnum;

	public organization: IOrganization;
	public policies$: Subject<any> = this.subject$;
	private _refresh$: Subject<any> = new Subject();

	constructor(
		private readonly httpClient: HttpClient,
		public readonly translateService: TranslateService,
		private readonly store: Store,
		private readonly dialogService: NbDialogService,
		private readonly toastrService: ToastrService,
		private readonly approvalPolicyService: ApprovalPolicyService
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();
	}

	ngAfterViewInit() {
		this.policies$
			.pipe(
				debounceTime(300),
				tap(() => this.clearItem()),
				tap(() => this.getApprovalPolicies()),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this.policies$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				debounceTime(300),
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this._refresh$.next(true)),
				tap(() => this.policies$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this._refresh$
			.pipe(
				filter(() => this._isGridLayout),
				tap(() => this.refreshPagination()),
				tap(() => (this.approvalPolicies = [])),
				untilDestroyed(this)
			)
			.subscribe();
	}

	setView() {
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				debounceTime(300),
				distinctUntilChange(),
				tap((componentLayout) => (this.dataLayoutStyle = componentLayout)),
				tap(() => this.refreshPagination()),
				filter(() => this._isGridLayout),
				tap(() => (this.approvalPolicies = [])),
				tap(() => this.policies$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	async getApprovalPolicies() {
		if (!this.organization) {
			return;
		}
		try {
			this.setSmartTableSource();

			const { activePage, itemsPerPage } = this.getPagination();
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);

			if (this._isGridLayout) this._loadGridLayout();
		} catch (error) {
			console.log('Error while retrieving approval policies', error);
			this.toastrService.danger(error);
		}
	}

	private async _loadGridLayout() {
		const data = await this.smartTableSource.getElements();
		this.approvalPolicies.push(...data);
	}

	/*
	 * Register Smart Table Source Config
	 */
	private setSmartTableSource() {
		if (!this.organization) {
			return;
		}
		this.loading = true;
		const { id: organizationId, tenantId } = this.organization;

		this.smartTableSource = new ServerDataSource(this.httpClient, {
			endPoint: `${API_PREFIX}/approval-policy/pagination`,
			where: {
				organizationId,
				tenantId,
				...(this.filters.where ? this.filters.where : {})
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

	private _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.settingsSmartTable = {
			actions: false,
			selectedRowIndex: -1,
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.APPROVAL_POLICY'),
			columns: {
				name: {
					title: this.getTranslation('APPROVAL_POLICY_PAGE.APPROVAL_POLICY_NAME'),
					type: 'string',
					isFilterable: {
						type: 'custom',
						component: InputFilterComponent
					},
					filterFunction: (value: string) => {
						this.setFilter({ field: 'name', search: value });
					}
				},
				description: {
					title: this.getTranslation('APPROVAL_POLICY_PAGE.APPROVAL_POLICY_DESCRIPTION'),
					type: 'string',
					isFilterable: false
				}
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

	async edit(selectedItem?: IApprovalPolicy) {
		try {
			if (selectedItem) {
				this.selectApprovalPolicy({
					isSelected: true,
					data: selectedItem
				});
			}
			const dialog = this.dialogService.open(ApprovalPolicyMutationComponent, {
				context: {
					approvalPolicy: this.selectedApprovalPolicy
				}
			});
			const result: IApprovalPolicy = await firstValueFrom(dialog.onClose);
			if (result) {
				this.toastrService.success('TOASTR.MESSAGE.APPROVAL_POLICY_UPDATED', {
					name: result.name
				});
				this._refresh$.next(true);
				this.policies$.next(true);
			}
		} catch (error) {
			console.log('Error while updating approval policy', error);
		}
	}

	async add() {
		try {
			const dialog = this.dialogService.open(ApprovalPolicyMutationComponent);
			const result: IApprovalPolicy = await firstValueFrom(dialog.onClose);
			if (result) {
				this.toastrService.success('TOASTR.MESSAGE.APPROVAL_POLICY_CREATED', {
					name: result.name
				});
				this._refresh$.next(true);
				this.policies$.next(true);
			}
		} catch (error) {
			console.log('Error while creating approval policy', error);
		}
	}

	async selectApprovalPolicy({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedApprovalPolicy = isSelected ? data : null;
	}

	async delete(selectedItem?: IApprovalPolicy) {
		if (selectedItem) {
			this.selectApprovalPolicy({
				isSelected: true,
				data: selectedItem
			});
		}
		const result = await firstValueFrom(this.dialogService.open(DeleteConfirmationComponent).onClose);

		if (result) {
			await this.approvalPolicyService.delete(this.selectedApprovalPolicy.id);
			const { name } = this.selectedApprovalPolicy;
			this.toastrService.success('TOASTR.MESSAGE.APPROVAL_POLICY_DELETED', {
				name
			});
		}
		this._refresh$.next(true);
		this.policies$.next(true);
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
		this.selectApprovalPolicy({
			isSelected: false,
			data: null
		});
	}

	private get _isGridLayout(): boolean {
		return this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID;
	}

	ngOnDestroy(): void {}
}
