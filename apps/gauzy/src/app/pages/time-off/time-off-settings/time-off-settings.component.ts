import {
	Component,
	OnInit,
	OnDestroy,
	ErrorHandler,
	ViewChild
} from '@angular/core';
import {
	ComponentLayoutStyleEnum,
	IOrganization,
	ITimeOffPolicy,
	ITimeOffPolicyVM
} from '@gauzy/contracts';
import { filter, finalize, first, tap } from 'rxjs/operators';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/common-angular';
import { TimeOffSettingsMutationComponent } from '../../../@shared/time-off/settings-mutation/time-off-settings-mutation.component';
import { DeleteConfirmationComponent } from '../../../@shared/user/forms';
import { PaidIcon, RequestApprovalIcon } from '../table-components';
import { ComponentEnum } from '../../../@core/constants';
import { Store, TimeOffService, ToastrService } from '../../../@core/services';
import {
	PaginationFilterBaseComponent,
	IPaginationBase
} from '../../../@shared/pagination/pagination-filter-base.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-time-off-settings',
	templateUrl: './time-off-settings.component.html',
	styleUrls: ['./time-off-settings.component.scss']
})
export class TimeOffSettingsComponent extends PaginationFilterBaseComponent
	implements OnInit, OnDestroy {

	constructor(
		private readonly dialogService: NbDialogService,
		private readonly toastrService: ToastrService,
		private readonly timeOffService: TimeOffService,
		private readonly store: Store,
		private readonly errorHandler: ErrorHandler,
		public readonly translateService: TranslateService,
	) {
		super(translateService);
		this.setView();
	}

	smartTableSettings: object;
	selectedPolicy: ITimeOffPolicyVM;
	smartTableSource = new LocalDataSource();
	timeOffPolicies: ITimeOffPolicyVM[] = [];
	loading = false;
	disableButton = true;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	organization: IOrganization;

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
		this._loadSettingsSmartTable();
		this._applyTranslationOnSmartTable();

		this.subject$
			.pipe(
				tap(() => this.clearItem()),
				tap(() => this._getTimeOffSettings()),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				distinctUntilChange(),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => this.organization = organization),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	setView() {
		this.viewComponentName = ComponentEnum.TIME_OFF_SETTINGS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				tap(
					(componentLayout: ComponentLayoutStyleEnum) => 
					this.dataLayoutStyle = componentLayout
				),
				tap(() => this.subject$.next(true)),
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
				tap(() => this.clearItem())
			)
			.subscribe();
	}

	private _loadSettingsSmartTable() {
		const pagination: IPaginationBase = this.getPagination();
		this.smartTableSettings = {
			actions: false,
			editable: true,
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA'),
			columns: {
				name: {
					title: this.getTranslation('TIME_OFF_PAGE.POLICY.NAME'),
					type: 'string',
					filter: true
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
			},
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			}
		};
	}

	openAddPolicyDialog() {
		this.dialogService
			.open(TimeOffSettingsMutationComponent)
			.onClose
			.pipe(
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
				.pipe(
					first(),
					untilDestroyed(this)
				)
				.subscribe({
					next: () => {
						this.toastrService.success('NOTES.POLICY.ADD_POLICY', {
							name: policy.name
						});
						this.subject$.next(true)
					},
					error: () => {
						this.toastrService.danger('NOTES.POLICY.SAVE_ERROR');
					}
				});
		}
	}

	async openEditPolicyDialog(selectedItem?: ITimeOffPolicyVM) {
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
			.onClose
			.pipe(
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
			.pipe(
				first(),
				untilDestroyed(this)
			)
			.subscribe({
				next: () => {
					this.toastrService.success('NOTES.POLICY.EDIT_POLICY', {
						name: policy.name
					});
					this.subject$.next(true);
				},
				error: (error) => this.errorHandler.handleError(error)
			});
	}

	deletePolicy(selectedItem?: ITimeOffPolicyVM) {
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
			.onClose.pipe(untilDestroyed(this))
			.subscribe({
				next: (result) => {
					if (result) {
						this.timeOffService
							.deletePolicy(this.selectedPolicy.id)
							.pipe(first(), untilDestroyed(this))
							.subscribe(() => {
								this.toastrService.success(
									'NOTES.POLICY.DELETE_POLICY',
									{ name: this.selectedPolicy.name }
								);
								this.subject$.next(true);
							});
					}
				},
				error: (error) => this.errorHandler.handleError(error)
			});
	}

	selectTimeOffPolicy({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedPolicy = isSelected ? data : null;
	}

	private _getTimeOffSettings() {
		if (!this.organization) {
			return;
		}

		this.loading = true;
		const { itemsPerPage, activePage } = this.getPagination();
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;

		this.timeOffService
			.getAllPolicies(['employees'], {
				organizationId,
				tenantId
			})
			.pipe(
				first(),
				finalize(() => this.loading = false),
				untilDestroyed(this)
			)
			.subscribe({
				next: (res) => {
					const items = res.items;
					const policyVM: ITimeOffPolicyVM[] = items.map((i) => {
						return {
							id: i.id,
							name: i.name,
							requiresApproval: i.requiresApproval,
							paid: i.paid,
							employees: i.employees
						};
					});
					this.timeOffPolicies = policyVM;
					this.smartTableSource.setPaging(
						activePage,
						itemsPerPage,
						false
					);
					this.smartTableSource.load(policyVM);
					if (
						this.dataLayoutStyle ===
						ComponentLayoutStyleEnum.CARDS_GRID
					) {
						this._loadGridLayoutData();
					}
					this.setPagination({
						...this.getPagination(),
						totalItems: this.smartTableSource.count()
					});
					this.clearItem();
				},
				error: (error) => {
					this.toastrService.danger(
						this.getTranslation('', {
							error: error.error.message || error.message
						}),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
				}
			});
	}

	private async _loadGridLayoutData() {
		this.timeOffPolicies = await this.smartTableSource.getElements();
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSettingsSmartTable()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
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
			this.timeOffPolicySettingsTable.grid.dataSet['willSelect'] = 'false';
			this.timeOffPolicySettingsTable.grid.dataSet.deselectAll();
		}
	}

	ngOnDestroy() {}
}
