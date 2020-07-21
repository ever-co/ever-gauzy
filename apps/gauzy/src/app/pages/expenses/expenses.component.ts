import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { AuthService } from '../../@core/services/auth.service';
import {
	Expense,
	PermissionsEnum,
	IExpenseCategory,
	IOrganizationVendor,
	Tag,
	ComponentLayoutStyleEnum
} from '@gauzy/models';
import { takeUntil } from 'rxjs/operators';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { ExpensesMutationComponent } from '../../@shared/expenses/expenses-mutation/expenses-mutation.component';
import { Store } from '../../@core/services/store.service';
import { Subject } from 'rxjs';
import { ExpensesService } from '../../@core/services/expenses.service';
import { LocalDataSource } from 'ng2-smart-table';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { DateViewComponent } from '../../@shared/table-components/date-view/date-view.component';
import {
	ActivatedRoute,
	RouterEvent,
	NavigationEnd,
	Router
} from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { ErrorHandlingService } from '../../@core/services/error-handling.service';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { IncomeExpenseAmountComponent } from '../../@shared/table-components/income-amount/income-amount.component';
import { ExpenseCategoriesStoreService } from '../../@core/services/expense-categories-store.service';
import { NotesWithTagsComponent } from '../../@shared/table-components/notes-with-tags/notes-with-tags.component';
import { ComponentEnum } from '../../@core/constants/layout.constants';

export interface ExpenseViewModel {
	id: string;
	valueDate: Date;
	vendorId: string;
	vendorName: string;
	vendor: IOrganizationVendor;
	typeOfExpense: string;
	categoryId: string;
	categoryName: string;
	category: IExpenseCategory;
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
	splitExpense: boolean;
	tags: Tag[];
	status: string;
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
	expenses: Expense[];
	selectedExpense: ExpenseViewModel;
	showTable: boolean;
	employeeName: string;
	loading = true;
	hasEditPermission = false;
	viewComponentName: ComponentEnum;
	private _ngDestroy$ = new Subject<void>();
	private _selectedOrganizationId: string;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	disableButton = true;
	@ViewChild('expensesTable') expensesTable;

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
					renderComponent: IncomeExpenseAmountComponent
				},
				notes: {
					title: this.getTranslation('SM_TABLE.NOTES'),
					type: 'custom',
					class: 'align-row',
					renderComponent: NotesWithTagsComponent
				},
				purpose: {
					title: 'Purpose',
					type: 'string'
				},
				status: {
					title: this.getTranslation('SM_TABLE.STATUS'),
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
		readonly translateService: TranslateService,
		private expenseCategoriesStore: ExpenseCategoriesStoreService,
		private readonly router: Router
	) {
		super(translateService);
		this.setView();
	}

	async ngOnInit() {
		this.expenseCategoriesStore.loadAll();
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

		this.router.events
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((event: RouterEvent) => {
				if (event instanceof NavigationEnd) {
					this.setView();
				}
			});
	}

	setView() {
		this.viewComponentName = ComponentEnum.EXPENSES;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
			});
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
			category: formData.category,
			vendor: formData.vendor,
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
			receipt: formData.receipt,
			splitExpense: formData.splitExpense,
			tags: formData.tags,
			status: formData.status
		};
	}

	async addExpense(completedForm, formData) {
		try {
			await this.expenseService.create({
				...completedForm,
				employeeId: formData.employee ? formData.employee.id : null,
				orgId: this.store.selectedOrganization.id
			});

			this.toastrService.primary(
				this.getTranslation('NOTES.EXPENSES.ADD_EXPENSE', {
					name: formData.employee
						? `${formData.employee.firstName} ${formData.employee.lastName}`
						: this.getTranslation('SM_TABLE.EMPLOYEE')
				}),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);

			this._loadTableData();
			this.store.selectedEmployee = formData.employee
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

	openEditExpenseDialog(selectedItem?: Expense) {
		if (selectedItem) {
			this.selectExpense({
				isSelected: true,
				data: selectedItem
			});
		}
		this.dialogService
			.open(ExpensesMutationComponent, {
				context: {
					expense: this.selectedExpense
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

	openDuplicateExpenseDialog(selectedItem?: Expense) {
		if (selectedItem) {
			this.selectExpense({
				isSelected: true,
				data: selectedItem
			});
		}
		if (!this.store.selectedDate) {
			this.store.selectedDate = this.store.getDateFromOrganizationSettings();
		}

		this.dialogService
			.open(ExpensesMutationComponent, {
				context: {
					expense: this.selectedExpense,
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

	async deleteExpense(selectedItem?: Expense) {
		if (selectedItem) {
			this.selectExpense({
				isSelected: true,
				data: selectedItem
			});
		}
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
							this.selectedExpense.id
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

	selectExpense({ isSelected, data }) {
		const selectedExpense = isSelected ? data : null;
		if (this.expensesTable) {
			this.expensesTable.grid.dataSet.willSelect = false;
		}
		this.disableButton = !isSelected;
		this.selectedExpense = selectedExpense;
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
				['employee', 'employee.user', 'category', 'vendor', 'tags'],
				findObj,
				this.selectedDate
			);

			const expenseVM: ExpenseViewModel[] = items.map((i) => {
				return {
					id: i.id,
					valueDate: i.valueDate,
					vendorId: i.vendorId,
					vendorName: i.vendor.name,
					vendor: i.vendor,
					typeOfExpense: i.typeOfExpense,
					categoryId: i.categoryId,
					categoryName: i.category.name,
					category: i.category,
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
					receipt: i.receipt,
					splitExpense: i.splitExpense,
					tags: i.tags,
					status: i.status
				};
			});
			this.expenses = items;
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
			: 'All Employees';
		this.loading = false;
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
