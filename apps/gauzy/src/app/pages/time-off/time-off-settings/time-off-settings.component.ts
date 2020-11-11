import {
	Component,
	OnInit,
	OnDestroy,
	ErrorHandler,
	ViewChild
} from '@angular/core';
import { AuthService } from '../../../@core/services/auth.service';
import {
	RolesEnum,
	ComponentLayoutStyleEnum,
	IOrganization,
	ITimeOffPolicyVM,
	IRolePermission
} from '@gauzy/models';
import { filter, first, tap } from 'rxjs/operators';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { TimeOffSettingsMutationComponent } from '../../../@shared/time-off/settings-mutation/time-off-settings-mutation.component';
import { TranslateService } from '@ngx-translate/core';
import { TimeOffService } from '../../../@core/services/time-off.service';
import { Store } from '../../../@core/services/store.service';
import { DeleteConfirmationComponent } from '../../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { RequestApprovalIcon } from '../table-components/request-approval-icon';
import { PaidIcon } from '../table-components/paid-icon';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ComponentEnum } from '../../../@core/constants/layout.constants';
import { Router, RouterEvent, NavigationEnd } from '@angular/router';
import { NgxPermissionsService } from 'ngx-permissions';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-time-off-settings',
	templateUrl: './time-off-settings.component.html',
	styleUrls: ['./time-off-settings.component.scss']
})
export class TimeOffSettingsComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	constructor(
		private dialogService: NbDialogService,
		private authService: AuthService,
		private toastrService: NbToastrService,
		private timeOffService: TimeOffService,
		private store: Store,
		private errorHandler: ErrorHandler,
		readonly translateService: TranslateService,
		private router: Router,
		private readonly ngxPermissionsService: NgxPermissionsService
	) {
		super(translateService);
		this.setView();
	}

	private _selectedOrganizationId: string;
	smartTableSettings: object;
	hasRole: boolean;
	selectedPolicy: ITimeOffPolicyVM;
	smartTableSource = new LocalDataSource();
	timeOffPolicyData: ITimeOffPolicyVM[];
	selectedPolicyId: string;
	showTable: boolean;
	loading = false;
	hasEditPermission = false;
	disableButton = true;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
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
		this.store.userRolePermissions$
			.pipe(
				filter(
					(permissions: IRolePermission[]) => permissions.length > 0
				),
				untilDestroyed(this)
			)
			.subscribe((data) => {
				const permissions = data.map(({ permission }) => permission);
				this.ngxPermissionsService.loadPermissions(permissions);
			});
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe((org) => {
				if (org) {
					this.organization = org;
					this._selectedOrganizationId = org.id;
					this._loadTableData(this._selectedOrganizationId);
				}
			});
		this.authService
			.hasRole([RolesEnum.ADMIN, RolesEnum.DATA_ENTRY])
			.pipe(first())
			.subscribe((res) => (this.hasRole = res));
		this.router.events
			.pipe(untilDestroyed(this))
			.subscribe((event: RouterEvent) => {
				if (event instanceof NavigationEnd) {
					this.setView();
				}
			});
	}

	setView() {
		this.viewComponentName = ComponentEnum.TIME_OFF_SETTINGS;
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
		this.timeOffPolicySettingsTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this.clearItem())
			)
			.subscribe();
	}

	private _loadSettingsSmartTable() {
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
				display: true,
				perPage: 8
			}
		};
	}

	openAddPolicyDialog() {
		this.dialogService
			.open(TimeOffSettingsMutationComponent)
			.onClose.pipe(first(), untilDestroyed(this))
			.subscribe((formData) => {
				if (formData) {
					this.addPolicy(formData);
				}
			});
	}

	addPolicy(formData) {
		if (formData) {
			this.timeOffService
				.createPolicy(formData)
				.pipe(first(), untilDestroyed(this))
				.subscribe(
					() => {
						this.toastrService.primary(
							this.getTranslation('NOTES.POLICY.ADD_POLICY'),
							this.getTranslation('TOASTR.TITLE.SUCCESS')
						);
						this._loadTableData(this._selectedOrganizationId);
					},
					() =>
						this.toastrService.danger(
							'Unable to create Policy record'
						)
				);
		}
	}

	async openEditPolicyDialog(selectedItem?: ITimeOffPolicyVM) {
		if (selectedItem) {
			this.selectTimeOffPolicy({
				isSelected: true,
				data: selectedItem
			});
		}
		this.selectedPolicyId = this.selectedPolicy.id;

		this.dialogService
			.open(TimeOffSettingsMutationComponent, {
				context: {
					policy: this.selectedPolicy
				}
			})
			.onClose.pipe(untilDestroyed(this))
			.subscribe((formData) => {
				if (formData) {
					this.editPolicy(formData);
				}
			});
	}

	editPolicy(formData) {
		this.timeOffService
			.updatePolicy(this.selectedPolicyId, formData)
			.pipe(first(), untilDestroyed(this))
			.subscribe(
				() => {
					this.toastrService.primary(
						this.getTranslation('NOTES.POLICY.EDIT_POLICY'),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);

					this._loadTableData(this._selectedOrganizationId);
				},
				(error) => this.errorHandler.handleError(error)
			);
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
					recordType: 'Policy'
				}
			})
			.onClose.pipe(untilDestroyed(this))
			.subscribe(
				(result) => {
					if (result) {
						this.timeOffService
							.deletePolicy(this.selectedPolicy.id)
							.pipe(first(), untilDestroyed(this))
							.subscribe(() => {
								this.toastrService.primary(
									this.getTranslation(
										'NOTES.POLICY.DELETE_POLICY'
									),
									this.getTranslation('TOASTR.TITLE.SUCCESS')
								);
								this._loadTableData(
									this._selectedOrganizationId
								);
								this.clearItem();
							});
					}
				},
				(error) => this.errorHandler.handleError(error)
			);
	}

	selectTimeOffPolicy({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedPolicy = isSelected ? data : null;
	}

	private async _loadTableData(orgId: string) {
		this.showTable = false;
		this.selectedPolicy = null;
		let findObj: {};

		if (orgId) {
			findObj = {
				organization: {
					id: orgId
				},
				tenantId: this.organization.tenantId
			};

			this.timeOffService
				.getAllPolicies(['employees'], findObj)
				.pipe(first(), untilDestroyed(this))
				.subscribe(
					(res) => {
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
						this.timeOffPolicyData = policyVM;
						this.smartTableSource.load(policyVM);
						this.showTable = true;
						this.clearItem();
					},
					(error) => {
						this.toastrService.danger(
							this.getTranslation('', {
								error: error.error.message || error.message
							}),
							this.getTranslation('TOASTR.TITLE.ERROR')
						);
					}
				);
		}
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this._loadSettingsSmartTable();
			});
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
			this.timeOffPolicySettingsTable.grid.dataSet['willSelect'] =
				'false';
			this.timeOffPolicySettingsTable.grid.dataSet.deselectAll();
		}
	}

	ngOnDestroy() {}
}
