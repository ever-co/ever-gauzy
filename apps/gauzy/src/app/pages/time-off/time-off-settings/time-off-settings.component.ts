import {
	Component,
	OnInit,
	OnDestroy,
	ErrorHandler,
	ViewChild
} from '@angular/core';
import { AuthService } from '../../../@core/services/auth.service';
import { RolesEnum, Employee, PermissionsEnum } from '@gauzy/models';
import { first, takeUntil } from 'rxjs/operators';
import { LocalDataSource } from 'ng2-smart-table';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { TimeOffSettingsMutationComponent } from '../../../@shared/time-off/settings-mutation/time-off-settings-mutation.component';
import { TranslateService } from '@ngx-translate/core';
import { TimeOffService } from '../../../@core/services/time-off.service';
import { Subject } from 'rxjs';
import { Store } from '../../../@core/services/store.service';
import { DeleteConfirmationComponent } from '../../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { RequestApprovalIcon } from '../table-components/request-approval-icon';
import { PaidIcon } from '../table-components/paid-icon';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';

export interface TimeOffPolicyVM {
	id: string;
	name: string;
	requiresApproval: boolean;
	paid: boolean;
	employees: Employee[];
}

interface SelectedRowModel {
	data: TimeOffPolicyVM;
	isSelected: boolean;
	selected: TimeOffPolicyVM[];
	source: LocalDataSource;
}

@Component({
	selector: 'ga-time-off-settings',
	templateUrl: './time-off-settings.component.html',
	styleUrls: ['./time-off-settings.component.scss']
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
	private _ngDestroy$ = new Subject<void>();
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
		this.loadSettingsSmartTable();
		this._applyTranslationOnSmartTable();

		this.store.userRolePermissions$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.hasEditPermission = this.store.hasPermission(
					PermissionsEnum.POLICY_EDIT
				);
			});
		this.hasRole = await this.authService
			.hasRole([RolesEnum.ADMIN, RolesEnum.DATA_ENTRY])
			.pipe(first())
			.toPromise();

		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((org) => {
				if (org) {
					this._selectedOrganizationId = org.id;
					this._loadTableData(this._selectedOrganizationId);
				}
			});
	}

	loadSettingsSmartTable() {
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

	async openAddPolicyDialog() {
		this.dialogService
			.open(TimeOffSettingsMutationComponent)
			.onClose.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (formData) => {
				if (formData) {
					await this.addPolicy(formData);
					this._loadTableData(this._selectedOrganizationId);
				}
			});
	}

	async addPolicy(formData) {
		if (formData) {
			try {
				await this.tymeOffService.createPolicy(formData);

				this.toastrService.primary(
					this.getTranslation('NOTES.POLICY.ADD_POLICY'),
					this.getTranslation('TOASTR.TITLE.SUCCESS')
				);
			} catch (err) {
				console.log(err);
			}
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
			.onClose.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (formData) => {
				if (formData) {
					await this.editPolicy(formData);
					this._loadTableData(this._selectedOrganizationId);
				}
			});
	}

	async editPolicy(formData) {
		if (formData) {
			try {
				await this.tymeOffService.updatePolicy(
					this.selectedPolicyId,
					formData
				);
				this.toastrService.primary(
					this.getTranslation('NOTES.POLICY.EDIT_POLICY'),
					this.getTranslation('TOASTR.TITLE.SUCCESS')
				);

				this._loadTableData(this._selectedOrganizationId);
			} catch (error) {
				this.errorHandler.handleError(error);
			}
		}
	}

	async deletePolicy() {
		this.dialogService
			.open(DeleteConfirmationComponent, {
				context: {
					recordType: 'Policy'
				}
			})
			.onClose.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (result) => {
				if (result) {
					try {
						await this.tymeOffService.deletePolicy(
							this.selectedPolicy.data.id
						);

						this.toastrService.primary(
							this.getTranslation('NOTES.POLICY.DELETE_POLICY'),
							this.getTranslation('TOASTR.TITLE.SUCCESS')
						);
						this._loadTableData(this._selectedOrganizationId);
						this.selectedPolicy = null;
					} catch (error) {
						this.errorHandler.handleError(error);
					}
				}
			});
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

			try {
				const { items } = await this.tymeOffService.getAllPolicies(
					['employees'],
					findObj
				);

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
			} catch (error) {
				this.toastrService.danger(
					this.getTranslation('', {
						error: error.error.message || error.message
					}),
					this.getTranslation('TOASTR.TITLE.ERROR')
				);
			}
		}
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange.subscribe(() => {
			this.loadSettingsSmartTable();
		});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
