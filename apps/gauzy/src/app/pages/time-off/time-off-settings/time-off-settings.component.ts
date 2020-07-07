import { Component, OnInit, OnDestroy, ErrorHandler, ViewChild } from '@angular/core';
import { AuthService } from '../../../@core/services/auth.service';
import { RolesEnum, Employee, PermissionsEnum } from '@gauzy/models';
import { first } from 'rxjs/operators';
import { LocalDataSource } from 'ng2-smart-table';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { TimeOffSettingsMutationComponent } from '../../../@shared/time-off/settings-mutation/time-off-settings-mutation.component';
import { TranslateService } from '@ngx-translate/core';
import { TimeOffService } from '../../../@core/services/time-off.service';
import { Store } from '../../../@core/services/store.service';
import { DeleteConfirmationComponent } from '../../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { RequestApprovalIcon } from '../table-components/request-approval-icon';
import { PaidIcon } from '../table-components/paid-icon';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { untilDestroyed } from 'ngx-take-until-destroy';

export interface TimeOffPolicyVM {
	id: string;
	name: string;
	requiresApproval: boolean;
	paid: boolean;
	employees: Employee[];
}

export interface SelectedRowModel {
	data: TimeOffPolicyVM;
	isSelected: boolean;
	selected: TimeOffPolicyVM[];
	source: LocalDataSource;
}

@Component({
	selector: 'ga-time-off-settings',
	templateUrl: './time-off-settings.component.html'
})
export class TimeOffSettingsComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	constructor(
		private dialogService: NbDialogService,
		private authService: AuthService,
		private toastrService: NbToastrService,
		private tymeOffService: TimeOffService,
		private store: Store,
		private errorHandler: ErrorHandler,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	private _selectedOrganizationId: string;
	smartTableSettings: object;
	hasRole: boolean;
	selectedPolicy: SelectedRowModel;
	smartTableSource = new LocalDataSource();

	selectedPolicyId: string;
	showTable: boolean;
	loading = false;
	hasEditPermission = false;

	@ViewChild('timeOffPolicyTable') timeOffPolicyTable;

	async ngOnInit() {
		this._loadSettingsSmartTable();
		this._applyTranslationOnSmartTable();

		this.store.userRolePermissions$
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.hasEditPermission = this.store.hasPermission(
					PermissionsEnum.POLICY_EDIT
				);
			});

		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((org) => {
				if (org) {
					this._selectedOrganizationId = org.id;
					this._loadTableData(this._selectedOrganizationId);
				}
			});

		this.authService
			.hasRole([RolesEnum.ADMIN, RolesEnum.DATA_ENTRY])
			.pipe(first())
			.subscribe((res) => (this.hasRole = res));
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
			.onClose.pipe(first())
			.subscribe((formData) => {
				if (formData) {
					this.addPolicy(formData);
					this._loadTableData(this._selectedOrganizationId);
				}
			});
	}

	addPolicy(formData) {
		if (formData) {
			this.tymeOffService
				.createPolicy(formData)
				.pipe(first())
				.subscribe(() => {
					this.toastrService.primary(
						this.getTranslation('NOTES.POLICY.ADD_POLICY'),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
					this._loadTableData(this._selectedOrganizationId);
				}, () => this.toastrService.danger('Unable to create Policy record'));
		}
	}

	async openEditPolicyDialog() {
		this.selectedPolicyId = this.selectedPolicy.data.id;

		this.dialogService
			.open(TimeOffSettingsMutationComponent, {
				context: {
					policy: this.selectedPolicy.data
				}
			})
			.onClose.pipe(untilDestroyed(this))
			.subscribe((formData) => {
				if (formData) {
					this.editPolicy(formData);
					this._loadTableData(this._selectedOrganizationId);
				}
			});
	}

	editPolicy(formData) {
		this.tymeOffService
			.updatePolicy(this.selectedPolicyId, formData)
			.pipe(first())
			.subscribe(() => {
				this.toastrService.primary(
					this.getTranslation('NOTES.POLICY.EDIT_POLICY'),
					this.getTranslation('TOASTR.TITLE.SUCCESS')
				);

				this._loadTableData(this._selectedOrganizationId);
			}, (error) => this.errorHandler.handleError(error));
	}

	deletePolicy() {
		this.dialogService
			.open(DeleteConfirmationComponent, {
				context: {
					recordType: 'Policy'
				}
			})
			.onClose.pipe(untilDestroyed(this))
			.subscribe((result) => {
				if (result) {
					this.tymeOffService.deletePolicy(
						this.selectedPolicy.data.id
					).pipe(first()).subscribe(() => {
						this.toastrService.primary(
							this.getTranslation('NOTES.POLICY.DELETE_POLICY'),
							this.getTranslation('TOASTR.TITLE.SUCCESS')
						);
						this._loadTableData(this._selectedOrganizationId);
						this.selectedPolicy = null;
					});
				}
			}, (error) => this.errorHandler.handleError(error));
	}

	selectTimeOffPolicy(ev: SelectedRowModel) {
		this.selectedPolicy = ev;
	}

	private async _loadTableData(orgId: string) {
		this.showTable = false;
		this.selectedPolicy = null;
		let findObj: {};

		if (orgId) {
			findObj = {
				organization: {
					id: orgId
				}
			};

			this.tymeOffService
				.getAllPolicies(['employees'], findObj)
				.pipe(first())
				.subscribe((res) => {
					const items = res.items;
					const policyVM: TimeOffPolicyVM[] = items.map((i) => {
						return {
							id: i.id,
							name: i.name,
							requiresApproval: i.requiresApproval,
							paid: i.paid,
							employees: i.employees
						};
					});
					this.smartTableSource.load(policyVM);
					this.showTable = true;
				}, (error) => {
					this.toastrService.danger(
						this.getTranslation('', {
							error: error.error.message || error.message
						}),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
				});
		}
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange.subscribe(() => {
			this._loadSettingsSmartTable();
		});
	}

	ngOnDestroy() {}
}
