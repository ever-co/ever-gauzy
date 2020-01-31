import { Component, OnInit, OnDestroy, ErrorHandler } from '@angular/core';
import { AuthService } from '../../../@core/services/auth.service';
import { TimeOffPolicy, RolesEnum } from '@gauzy/models';
import { first, takeUntil } from 'rxjs/operators';
import { LocalDataSource } from 'ng2-smart-table';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { TimeOffSettingsMutationComponent } from '../../../@shared/time-off/settings-mutation/time-off-settings-mutation.component';
import { TimeOffService } from '../../../@core/services/time-off.service';
import { Subject } from 'rxjs';
import { Store } from '../../../@core/services/store.service';
import { DeleteConfirmationComponent } from '../../../@shared/user/forms/delete-confirmation/delete-confirmation.component';

export interface TimeOffPolicyVM {
	id: string;
	name: string;
	requiresApproval: boolean;
	paid: boolean;
}

interface SelectedRowModel {
	data: TimeOffPolicy;
	isSelected: boolean;
	selected: TimeOffPolicy[];
	source: LocalDataSource;
}

@Component({
	selector: 'ga-time-off-settings',
	templateUrl: './time-off-settings.component.html',
	styleUrls: ['./time-off-settings.component.scss']
})
export class TimeOffSettingsComponent implements OnInit, OnDestroy {
	constructor(
		private dialogService: NbDialogService,
		private authService: AuthService,
		private toastrService: NbToastrService,
		private tymeOffService: TimeOffService,
		private store: Store,
		private errorHandler: ErrorHandler
	) {}

	private _selectedOrganizationId: string;
	private _ngDestroy$ = new Subject<void>();
	hasRole: boolean;
	selectedPolicy: SelectedRowModel;
	smartTableSource = new LocalDataSource();
	showTable: boolean;
	loading = false;

	smartTableSettings = {
		actions: false,
		editable: true,
		noDataMessage: 'No Data',
		columns: {
			name: {
				title: 'Name',
				type: 'string',
				filter: true
			},
			requiresApproval: {
				title: 'Requires Approval',
				type: 'boolean',
				width: '20%',
				filter: false
			},
			paid: {
				title: 'Paid',
				type: 'boolean',
				width: '20%',
				filter: false
			}
		}
	};

	async ngOnInit() {
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
				console.log(formData);

				await this.tymeOffService.create(formData);

				// TODO translate
				this.toastrService.primary(
					'New Time off Policy created!',
					'Success'
				);
			} catch (err) {
				console.log(err);
			}
		}
	}

	async openEditPolicyDialog() {
		await this.dialogService
			// TODO: add Policy as context here
			.open(TimeOffSettingsMutationComponent)
			.onClose.pipe(takeUntil(this._ngDestroy$))
			.toPromise();
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
						await this.tymeOffService.delete(
							this.selectedPolicy.data.id
						);

						this.toastrService.primary('Policy deleted', 'Success');
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
		let findObj;

		if (orgId) {
			findObj = {
				organization: {
					id: orgId
				}
			};

			try {
				const { items } = await this.tymeOffService.getAll(
					['employees'],
					findObj
				);

				const policyVM: TimeOffPolicyVM[] = items.map((i) => {
					return {
						id: i.id,
						name: i.name,
						requiresApproval: i.requiresApproval,
						paid: i.paid
					};
				});

				this.smartTableSource.load(policyVM);
				this.showTable = true;
			} catch (error) {
				this.toastrService.danger(
					error.error.message || error.message,
					'Error'
				);
			}
		}
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
