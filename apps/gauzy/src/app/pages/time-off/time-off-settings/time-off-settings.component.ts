import {
	Component,
	OnInit,
	OnDestroy,
	ErrorHandler,
	ViewChild
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	ComponentLayoutStyleEnum,
	IOrganization,
	ITimeOffPolicy
} from '@gauzy/contracts';
import { combineLatest } from 'rxjs';
import { debounceTime, filter, first, tap } from 'rxjs/operators';
import { Ng2SmartTableComponent } from 'ng2-smart-table';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/common-angular';
import { TimeOffSettingsMutationComponent } from '../../../@shared/time-off';
import { DeleteConfirmationComponent } from '../../../@shared/user/forms';
import { PaidIcon, RequestApprovalIcon } from '../table-components';
import { API_PREFIX, ComponentEnum } from '../../../@core/constants';
import { Store, TimeOffService, ToastrService } from '../../../@core/services';
import {
	PaginationFilterBaseComponent,
	IPaginationBase
} from '../../../@shared/pagination/pagination-filter-base.component';
import { Subject } from 'rxjs/internal/Subject';
import { ServerDataSource } from '../../../@core/utils/smart-table';
import { EmployeeWithLinksComponent } from '../../../@shared';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-time-off-settings',
	templateUrl: './time-off-settings.component.html',
	styleUrls: ['./time-off-settings.component.scss']
})
export class TimeOffSettingsComponent
	extends PaginationFilterBaseComponent
	implements OnInit, OnDestroy
{
	constructor(
		private readonly dialogService: NbDialogService,
		private readonly toastrService: ToastrService,
		private readonly timeOffService: TimeOffService,
		private readonly store: Store,
		private readonly errorHandler: ErrorHandler,
		public readonly translateService: TranslateService,
		private readonly httpClient: HttpClient
	) {
		super(translateService);
		this.setView();
	}

	smartTableSettings: object;
	selectedPolicy: ITimeOffPolicy;
	smartTableSource: ServerDataSource;
	timeOffPolicies: ITimeOffPolicy[] = [];
	loading: boolean = false;
	disableButton: boolean = true;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;

	public organization: IOrganization;
	timeOffPolicies$: Subject<any> = this.subject$;

	timeOffPolicySettingsTable: Ng2SmartTableComponent;
	@ViewChild('timeOffPolicySettingsTable') set content(
		content: Ng2SmartTableComponent
	) {
		if (content) {
			this.timeOffPolicySettingsTable = content;
			this.onChangedSource();
		}
	}

	ngOnInit() {
		this._loadSettingsSmartTableSettings();
		this._applyTranslationOnSmartTable();

		this.timeOffPolicies$
			.pipe(
				debounceTime(300),
				tap(() => this._clearItem()),
				tap(() => this._getTimeOffSettings()),
				tap(() => this._loadSettingsSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this.store.selectedOrganization$;
		const pagination$ = this.pagination$;
		combineLatest([storeOrganization$, pagination$])
			.pipe(
				debounceTime(100),
				filter(([organization]) => !!organization),
				distinctUntilChange(),
				tap(([organization]) => (this.organization = organization)),
				tap(() => this.timeOffPolicies$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	setView() {
		this.viewComponentName = ComponentEnum.TIME_OFF_SETTINGS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap(
					(componentLayout) =>
						(this.dataLayoutStyle = componentLayout)
				),
				tap(() => this.timeOffPolicies$.next(true)),
				filter(
					(componentLayout) =>
						componentLayout === ComponentLayoutStyleEnum.CARDS_GRID
				),
				tap(() => this.refreshPagination()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.timeOffPolicySettingsTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this._clearItem())
			)
			.subscribe();
	}

	private _loadSettingsSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.smartTableSettings = {
			actions: false,
			editable: true,
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA'),
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
			columns: {
				name: {
					title: this.getTranslation('TIME_OFF_PAGE.POLICY.NAME'),
					type: 'string',
					filter: true
				},
				employees: {
					title: this.getTranslation('SM_TABLE.EMPLOYEES'),
					type: 'custom',
					filter: false,
					renderComponent: EmployeeWithLinksComponent
				},
				requiresApproval: {
					title: this.getTranslation(
						'TIME_OFF_PAGE.POLICY.REQUIRES_APPROVAL'
					),
					type: 'custom',
					width: '20%',
					filter: false,
					renderComponent: RequestApprovalIcon
				},
				paid: {
					title: this.getTranslation('TIME_OFF_PAGE.POLICY.PAID'),
					type: 'custom',
					width: '20%',
					filter: false,
					renderComponent: PaidIcon
				}
			}
		};
	}
	openAddPolicyDialog() {
		this.dialogService
			.open(TimeOffSettingsMutationComponent)
			.onClose.pipe(
				filter((policy: ITimeOffPolicy) => !!policy),
				tap((policy: ITimeOffPolicy) => this.addPolicy(policy)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	addPolicy(policy: ITimeOffPolicy) {
		if (policy) {
			this.timeOffService
				.createPolicy(policy)
				.pipe(first(), untilDestroyed(this))
				.subscribe({
					next: () => {
						this.toastrService.success('NOTES.POLICY.ADD_POLICY', {
							name: policy.name
						});
						this.timeOffPolicies$.next(true);
					},
					error: () => {
						this.toastrService.danger('NOTES.POLICY.SAVE_ERROR');
					}
				});
		}
	}

	async openEditPolicyDialog(selectedItem?: ITimeOffPolicy) {
		if (selectedItem) {
			this.selectTimeOffPolicy({
				isSelected: true,
				data: selectedItem
			});
		}
		this.dialogService
			.open(TimeOffSettingsMutationComponent, {
				context: {
					policy: this.selectedPolicy
				}
			})
			.onClose.pipe(
				filter((policy: ITimeOffPolicy) => !!policy),
				tap((policy: ITimeOffPolicy) => this.editPolicy(policy)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	editPolicy(policy: ITimeOffPolicy) {
		const selectedPolicyId = this.selectedPolicy.id;
		this.timeOffService
			.updatePolicy(selectedPolicyId, policy)
			.pipe(first(), untilDestroyed(this))
			.subscribe({
				next: () => {
					this.toastrService.success('NOTES.POLICY.EDIT_POLICY', {
						name: policy.name
					});
					this.timeOffPolicies$.next(true);
				},
				error: (error) => this.errorHandler.handleError(error)
			});
	}

	openDeletePolicyDialog(selectedItem?: ITimeOffPolicy) {
		if (selectedItem) {
			this.selectTimeOffPolicy({
				isSelected: true,
				data: selectedItem
			});
		}
		this.dialogService
			.open(DeleteConfirmationComponent, {
				context: {
					recordType: this.getTranslation(
						'TIME_OFF_PAGE.POLICY.POLICY'
					)
				}
			})
			.onClose.pipe(
				filter((result) => !!result),
				tap(() => this.deletePolicy()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	deletePolicy() {
		if (!this.selectedPolicy) {
			return;
		}
		this.timeOffService
			.deletePolicy(this.selectedPolicy.id)
			.pipe(first(), untilDestroyed(this))
			.subscribe({
				next: () => {
					this.toastrService.success('NOTES.POLICY.DELETE_POLICY', {
						name: this.selectedPolicy.name
					});
					this.timeOffPolicies$.next(true);
				},
				error: (error) => this.errorHandler.handleError(error)
			});
	}

	selectTimeOffPolicy({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedPolicy = isSelected ? data : null;
	}

	/*
	 * Register Smart Table Source Config
	 */
	setSmartTableSource() {
		if (!this.organization) {
			return;
		}
		try {
			this.loading = true;

			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;

			this.smartTableSource = new ServerDataSource(this.httpClient, {
				endPoint: `${API_PREFIX}/time-off-policy/pagination`,
				relations: ['employees', 'employees.user'],
				where: {
					...{
						organizationId,
						tenantId
					},
					...this.filters.where
				},
				finalize: () => {
					this.setPagination({
						...this.getPagination(),
						totalItems: this.smartTableSource.count()
					});
					this.loading = false;
				}
			});
		} catch (error) {
			this.toastrService.danger(
				this.getTranslation('', {
					error: error.error.message || error.message
				}),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		} finally {
			this.loading = false;
		}
	}

	/**
	 * GET all time off policies
	 *
	 * @returns
	 */
	private async _getTimeOffSettings() {
		if (!this.organization) {
			return;
		}
		this.setSmartTableSource();
		try {
			const { activePage, itemsPerPage } = this.getPagination();
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);
			if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {
				await this._loadGridLayoutData();
			}
		} catch (error) {
			this.toastrService.danger(
				this.getTranslation('', {
					error: error.error.message || error.message
				}),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		}
	}

	/**
	 * Load GRID layout policies
	 */
	private async _loadGridLayoutData() {
		try {
			this.timeOffPolicies = await this.smartTableSource.getElements();
			this.setPagination({
				...this.getPagination(),
				totalItems: this.smartTableSource.count()
			});
		} catch (error) {
			this.toastrService.danger(
				this.getTranslation('', {
					error: error.error.message || error.message
				}),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		}
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSettingsSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * Clear selected item
	 */
	private _clearItem() {
		this.selectTimeOffPolicy({
			isSelected: false,
			data: null
		});
		this.deselectAll();
	}

	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (
			this.timeOffPolicySettingsTable &&
			this.timeOffPolicySettingsTable.grid
		) {
			this.timeOffPolicySettingsTable.grid.dataSet['willSelect'] =
				'false';
			this.timeOffPolicySettingsTable.grid.dataSet.deselectAll();
		}
	}

	ngOnDestroy() {}
}
