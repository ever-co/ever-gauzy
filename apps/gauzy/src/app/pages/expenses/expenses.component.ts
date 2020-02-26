import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { AuthService } from '../../@core/services/auth.service';
import { Expense, PermissionsEnum } from '@gauzy/models';
import { takeUntil } from 'rxjs/operators';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { ExpensesMutationComponent } from '../../@shared/expenses/expenses-mutation/expenses-mutation.component';
import { Store } from '../../@core/services/store.service';
import { Subject } from 'rxjs';
import { ExpensesService } from '../../@core/services/expenses.service';
import { LocalDataSource } from 'ng2-smart-table';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { DateViewComponent } from '../../@shared/table-components/date-view/date-view.component';
import { ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { ErrorHandlingService } from '../../@core/services/error-handling.service';
import { IncomeAmountComponent } from '../../@shared/table-components/income-amount/income-amount.component';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';

export interface ExpenseViewModel {
	id: string;
	valueDate: Date;
	vendorId: string;
	vendorName: string;
	typeOfExpense: string;
	categoryId: string;
	categoryName: string;
	clientId: string;
	clientName: string;
	projectId: string;
	projectName: string;
	currency: string;
	amount: number;
	notes: string;
	purpose: string;
	taxType: string;
	taxLabel: string;
	rateValue: number;
	receipt: string;
}

interface SelectedRowModel {
	data: ExpenseViewModel;
	isSelected: boolean;
	selected: ExpenseViewModel[];
	source: LocalDataSource;
}

@Component({
	templateUrl: './expenses.component.html',
	styleUrls: ['./expenses.component.scss']
})
export class ExpensesComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	smartTableSettings: object;
	selectedEmployeeId: string;
	selectedDate: Date;

	smartTableSource = new LocalDataSource();

	selectedExpense: SelectedRowModel;
	showTable: boolean;
	employeeName: string;
	loading = true;
	hasEditPermission = false;

	private _ngDestroy$ = new Subject<void>();
	private _selectedOrganizationId: string;

	@ViewChild('expensesTable', { static: false }) expensesTable;

	loadSettingsSmartTable() {
		this.smartTableSettings = {
			actions: false,
			editable: true,
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA'),
			columns: {
				valueDate: {
					title: this.getTranslation('SM_TABLE.DATE'),
					type: 'custom',
					width: '10%',
					renderComponent: DateViewComponent,
					filter: false
				},
				vendorName: {
					title: this.getTranslation('SM_TABLE.VENDOR'),
					type: 'string'
				},
				categoryName: {
					title: this.getTranslation('SM_TABLE.CATEGORY'),
					type: 'string'
				},
				amount: {
					title: this.getTranslation('SM_TABLE.VALUE'),
					type: 'custom',
					width: '10%',
					filter: false,
					renderComponent: IncomeAmountComponent
				},
				notes: {
					title: this.getTranslation('SM_TABLE.NOTES'),
					type: 'string'
				},
				purpose: {
					title: 'Purpose',
					type: 'string'
				}
			}
		};
	}

	constructor(
		private authService: AuthService,
		private dialogService: NbDialogService,
		private store: Store,
		private expenseService: ExpensesService,
		private toastrService: NbToastrService,
		private route: ActivatedRoute,
		private errorHandler: ErrorHandlingService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	async ngOnInit() {
		this.loadSettingsSmartTable();
		this._applyTranslationOnSmartTable();

		this.store.userRolePermissions$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.hasEditPermission = this.store.hasPermission(
					PermissionsEnum.ORG_EXPENSES_EDIT
				);
			});

		this.store.selectedDate$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((date) => {
				this.selectedDate = date;

				if (this.selectedEmployeeId) {
					this._loadTableData();
				} else {
					if (this._selectedOrganizationId) {
						this._loadTableData(null, this._selectedOrganizationId);
					}
				}
			});

		this.store.selectedEmployee$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((employee) => {
				if (employee && employee.id) {
					this.selectedEmployeeId = employee.id;
					this._loadTableData();
				} else {
					if (this._selectedOrganizationId) {
						this.selectedEmployeeId = null;
						this._loadTableData(null, this._selectedOrganizationId);
					}
				}
			});

		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((org) => {
				if (org) {
					this._selectedOrganizationId = org.id;
					if (this.loading) {
						this._loadTableData(
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
					this.openAddExpenseDialog();
				}
			});

		this.loading = false;
	}

	canShowTable() {
		if (this.expensesTable) {
			this.expensesTable.grid.dataSet.willSelect = 'false';
		}
		return this.showTable;
	}

	getFormData(formData) {
		return {
			amount: formData.amount,
			categoryId: formData.category.categoryId,
			categoryName: formData.category.categoryName,
			vendorId: formData.vendor.vendorId,
			vendorName: formData.vendor.vendorName,
			typeOfExpense: formData.typeOfExpense,
			clientId: formData.client.clientId,
			clientName: formData.client.clientName,
			projectId: formData.project.projectId,
			projectName: formData.project.projectName,
			valueDate: formData.valueDate,
			notes: formData.notes,
			currency: formData.currency,
			purpose: formData.purpose,
			taxType: formData.taxType,
			taxLabel: formData.taxLabel,
			rateValue: formData.rateValue,
			receipt: formData.receipt
		};
	}

	async addExpense(completedForm, formData) {
		try {
			await this.expenseService.create({
				...completedForm,
				employeeId: formData.employee.id,
				orgId: this.store.selectedOrganization.id
			});

			this.toastrService.primary(
				this.getTranslation('NOTES.EXPENSES.ADD_EXPENSE', {
					name: this.employeeName
				}),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);

			this._loadTableData();
			this.store.selectedEmployee = formData.employee.id
				? formData.employee
				: null;
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	}

	openAddExpenseDialog() {
		if (!this.store.selectedDate) {
			this.store.selectedDate = this.store.getDateFromOrganizationSettings();
		}

		this.dialogService
			.open(ExpensesMutationComponent)
			.onClose.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (formData) => {
				if (formData) {
					const completedForm = this.getFormData(formData);
					this.addExpense(completedForm, formData);
				}
			});
	}

	openEditExpenseDialog() {
		this.dialogService
			.open(ExpensesMutationComponent, {
				context: {
					expense: this.selectedExpense.data
				}
			})
			.onClose.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (formData) => {
				if (formData) {
					try {
						await this.expenseService.update(
							formData.id,
							this.getFormData(formData)
						);
						this.toastrService.primary(
							this.getTranslation(
								'NOTES.EXPENSES.OPEN_EDIT_EXPENSE_DIALOG',
								{
									name: this.employeeName
								}
							),
							this.getTranslation('TOASTR.TITLE.SUCCESS')
						);

						this._loadTableData(
							this.selectedEmployeeId,
							this.selectedEmployeeId
								? null
								: this._selectedOrganizationId
						);
					} catch (error) {
						this.errorHandler.handleError(error);
					}
				}
			});
	}

	openDuplicateExpenseDialog() {
		if (!this.store.selectedDate) {
			this.store.selectedDate = this.store.getDateFromOrganizationSettings();
		}

		this.dialogService
			.open(ExpensesMutationComponent, {
				context: {
					expense: this.selectedExpense.data,
					duplicate: true
				}
			})
			.onClose.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (formData) => {
				if (formData) {
					const completedForm = this.getFormData(formData);
					this.addExpense(completedForm, formData);
				}
			});
	}

	async deleteExpense() {
		this.dialogService
			.open(DeleteConfirmationComponent, {
				context: {
					recordType: this.getTranslation(
						'FORM.DELETE_CONFIRMATION.EXPENSE'
					)
				}
			})
			.onClose.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (result) => {
				if (result) {
					try {
						await this.expenseService.delete(
							this.selectedExpense.data.id
						);

						this.toastrService.primary(
							this.getTranslation(
								'NOTES.EXPENSES.DELETE_EXPENSE',
								{
									name: this.employeeName
								}
							),
							this.getTranslation('TOASTR.TITLE.SUCCESS')
						);
						this._loadTableData(
							this.selectedEmployeeId,
							this.selectedEmployeeId
								? null
								: this._selectedOrganizationId
						);
						this.selectedExpense = null;
					} catch (error) {
						this.errorHandler.handleError(error);
					}
				}
			});
	}

	selectExpense(ev: SelectedRowModel) {
		this.selectedExpense = ev;
	}

	private async _loadTableData(
		employeeId = this.selectedEmployeeId,
		orgId?: string
	) {
		let findObj;
		this.showTable = false;
		this.selectedExpense = null;

		if (orgId) {
			findObj = {
				organization: {
					id: orgId
				}
			};

			this.smartTableSettings['columns']['employee'] = {
				title: 'Employee',
				type: 'string',
				valuePrepareFunction: (_, expense: Expense) => {
					const user = expense.employee
						? expense.employee.user
						: null;

					if (user) {
						return `${user.firstName} ${user.lastName}`;
					}
				}
			};
		} else {
			findObj = {
				employee: {
					id: employeeId
				}
			};

			delete this.smartTableSettings['columns']['employee'];
		}

		try {
			const { items } = await this.expenseService.getAll(
				['employee', 'employee.user'],
				findObj,
				this.selectedDate
			);

			const expenseVM: ExpenseViewModel[] = items.map((i) => {
				return {
					id: i.id,
					valueDate: i.valueDate,
					vendorId: i.vendorId,
					vendorName: i.vendorName,
					typeOfExpense: i.typeOfExpense,
					categoryId: i.categoryId,
					categoryName: i.categoryName,
					clientId: i.clientId,
					clientName: i.clientName,
					projectId: i.projectId,
					projectName: i.projectName,
					amount: i.amount,
					notes: i.notes,
					currency: i.currency,
					employee: i.employee,
					purpose: i.purpose,
					taxType: i.taxType,
					taxLabel: i.taxLabel,
					rateValue: i.rateValue,
					receipt: i.receipt
				};
			});

			this.smartTableSource.load(expenseVM);
			this.showTable = true;
		} catch (error) {
			this.toastrService.danger(
				this.getTranslation('NOTES.EXPENSES.EXPENSES_ERROR', {
					error: error.error.message || error.message
				}),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		}
		this.employeeName = this.store.selectedEmployee
			? (
					this.store.selectedEmployee.firstName +
					' ' +
					this.store.selectedEmployee.lastName
			  ).trim()
			: '';
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange.subscribe(() => {
			this.loadSettingsSmartTable();
		});
	}

	ngOnDestroy() {
		delete this.smartTableSettings['columns']['employee'];
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
