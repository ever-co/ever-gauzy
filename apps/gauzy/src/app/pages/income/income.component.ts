import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { AuthService } from '../../@core/services/auth.service';
import { RolesEnum, Income, Employee } from '@gauzy/models';
import { Subject, Observable, forkJoin } from 'rxjs';
import { takeUntil, first } from 'rxjs/operators';
import { Store } from '../../@core/services/store.service';
import { IncomeService } from '../../@core/services/income.service';
import { LocalDataSource } from 'ng2-smart-table';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { IncomeMutationComponent } from '../../@shared/income/income-mutation/income-mutation.component';
import { DateViewComponent } from '../../@shared/table-components/date-view/date-view.component';
import { ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { ErrorHandlingService } from '../../@core/services/error-handling.service';

interface SelectedRowModel {
	data: Income;
	isSelected: boolean;
	selected: Income[];
	source: LocalDataSource;
}

@Component({
	templateUrl: './income.component.html',
	styleUrls: ['./income.component.scss']
})
export class IncomeComponent implements OnInit, OnDestroy {
	constructor(
		private authService: AuthService,
		private store: Store,
		private incomeService: IncomeService,
		private dialogService: NbDialogService,
		private toastrService: NbToastrService,
		private route: ActivatedRoute,
		private errorHandler: ErrorHandlingService,
		private translateService: TranslateService
	) {}

	smartTableSettings: object;
	hasRole: boolean;
	selectedEmployeeId: string;
	selectedDate: Date;
	smartTableSource = new LocalDataSource();

	selectedIncome: SelectedRowModel;
	showTable: boolean;
	employeeName: string;
	loading = true;

	@ViewChild('incomeTable', { static: false }) incomeTable;

	private _ngDestroy$ = new Subject<void>();
	private _selectedOrganizationId: string;

	async ngOnInit() {
		this.loadSettingsSmartTable();
		this._applyTranslationOnSmartTable();

		this.hasRole = await this.authService
			.hasRole([RolesEnum.ADMIN, RolesEnum.DATA_ENTRY])
			.pipe(first())
			.toPromise();

		this.store.selectedDate$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((date) => {
				this.selectedDate = date;

				if (this.selectedEmployeeId) {
					this._loadEmployeeIncomeData(this.selectedEmployeeId);
				} else {
					if (this._selectedOrganizationId) {
						this._loadEmployeeIncomeData(
							null,
							this._selectedOrganizationId
						);
					}
				}
			});

		this.store.selectedEmployee$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((employee) => {
				if (employee && employee.id) {
					this.selectedEmployeeId = employee.id;
					this._loadEmployeeIncomeData(employee.id);
				} else {
					if (this._selectedOrganizationId) {
						this.selectedEmployeeId = null;
						this._loadEmployeeIncomeData(
							null,
							this._selectedOrganizationId
						);
					}
				}
			});

		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((org) => {
				if (org) {
					this._selectedOrganizationId = org.id;
					if (this.loading) {
						this._loadEmployeeIncomeData(
							this.store.selectedEmployee
								? this.store.selectedEmployee.id
								: null,
							this.store.selectedEmployee &&
								this.store.selectedEmployee.id
								? null
								: this._selectedOrganizationId
						);
					}
				}
			});

		this.route.queryParamMap
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((params) => {
				if (params.get('openAddDialog')) {
					this.addIncome();
				}
			});

		this.loading = false;
	}

	canShowTable() {
		if (this.incomeTable) {
			this.incomeTable.grid.dataSet.willSelect = 'false';
		}
		return this.showTable;
	}

	loadSettingsSmartTable() {
		this.smartTableSettings = {
			actions: false,
			mode: 'external',
			editable: true,
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA'),
			columns: {
				valueDate: {
					title: this.getTranslation('SM_TABLE.DATE'),
					type: 'custom',
					width: '20%',
					renderComponent: DateViewComponent,
					filter: false
				},
				clientName: {
					title: this.getTranslation('SM_TABLE.CLIENT_NAME'),
					type: 'string'
				},
				amount: {
					title: this.getTranslation('SM_TABLE.VALUE'),
					type: 'number',
					width: '15%',
					filter: false
				},
				notes: {
					title: this.getTranslation('SM_TABLE.NOTES'),
					type: 'string'
				}
			},
			pager: {
				display: true,
				perPage: 8
			}
		};
	}

	selectIncome(ev: SelectedRowModel) {
		this.selectedIncome = ev;
	}

	getTranslation(prefix: string) {
		let result = '';
		this.translateService.get(prefix).subscribe((res) => {
			result = res;
		});

		return result;
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange.subscribe(() => {
			this.loadSettingsSmartTable();
		});
	}

	async addIncome() {
		if (!this.store.selectedDate) {
			this.store.selectedDate = this.store.getDateFromOrganizationSettings();
		}

		const result = await this.dialogService
			.open(IncomeMutationComponent)
			.onClose.pipe(first())
			.toPromise();
		if (result) {
			try {
				await this.incomeService.create({
					amount: result.amount,
					clientName: result.client.clientName,
					clientId: result.client.clientId,
					valueDate: result.valueDate,
					employeeId: result.employee.id,
					orgId: this.store.selectedOrganization.id,
					notes: result.notes,
					currency: result.currency
				});

				this.toastrService.primary(
					'Income added for ' + this.employeeName,
					'Success'
				);

				this._loadEmployeeIncomeData();
				this.store.selectedEmployee = result.employee.id
					? result.employee
					: null;
			} catch (error) {
				this.toastrService.danger(
					error.error.message || error.message,
					'Error'
				);
			}
		}
	}

	async editIncome() {
		this.dialogService
			.open(IncomeMutationComponent, {
				context: {
					income: this.selectedIncome.data
				}
			})
			.onClose.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (result) => {
				if (result) {
					try {
						await this.incomeService.update(
							this.selectedIncome.data.id,
							{
								amount: result.amount,
								clientName: result.client.clientName,
								clientId: result.client.clientId,
								valueDate: result.valueDate,
								notes: result.notes,
								currency: result.currency
							}
						);

						this.toastrService.primary(
							'Income edited for ' + this.employeeName,
							'Success'
						);
						this._loadEmployeeIncomeData(
							this.selectedEmployeeId,
							this.selectedEmployeeId
								? null
								: this._selectedOrganizationId
						);
						this.selectedIncome = null;
					} catch (error) {
						this.errorHandler.handleError(error);
					}
				}
			});
	}

	async deleteIncome() {
		this.dialogService
			.open(DeleteConfirmationComponent, {
				context: {
					recordType: this.getTranslation('INCOME_PAGE.INCOME')
				}
			})
			.onClose.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (result) => {
				if (result) {
					try {
						await this.incomeService.delete(
							this.selectedIncome.data.id
						);

						this.toastrService.primary(
							'Income deleted for ' + this.employeeName,
							'Success'
						);
						this._loadEmployeeIncomeData(
							this.selectedEmployeeId,
							this.selectedEmployeeId
								? null
								: this._selectedOrganizationId
						);
						this.selectedIncome = null;
					} catch (error) {
						this.errorHandler.handleError(error);
					}
				}
			});
	}

	private async _loadEmployeeIncomeData(
		employeId = this.selectedEmployeeId,
		orgId?: string
	) {
		let findObj;
		this.showTable = false;
		this.selectedIncome = null;

		if (orgId) {
			findObj = {
				organization: {
					id: orgId
				}
			};
			this.smartTableSettings['columns']['employee'] = {
				title: this.getTranslation('SM_TABLE.EMPLOYEE'),
				type: 'string',
				valuePrepareFunction: (_, income: Income) => {
					const user = income.employee ? income.employee.user : null;

					if (user) {
						return `${user.firstName} ${user.lastName}`;
					}
				}
			};
		} else {
			findObj = {
				employee: {
					id: employeId
				}
			};
			delete this.smartTableSettings['columns']['employee'];
		}

		const { items } = await this.incomeService.getAll(
			['employee', 'employee.user'],
			findObj,
			this.selectedDate
		);
		this.employeeName = (
			this.store.selectedEmployee.firstName +
			' ' +
			this.store.selectedEmployee.lastName
		).trim();
		this.smartTableSource.load(items);
		this.showTable = true;
	}

	ngOnDestroy() {
		delete this.smartTableSettings['columns']['employee'];
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
