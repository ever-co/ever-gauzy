import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import {
	IExpense,
	ComponentLayoutStyleEnum,
	IOrganization,
	IExpenseViewModel
} from '@gauzy/contracts';
import { debounceTime, filter, tap, withLatestFrom } from 'rxjs/operators';
import { NbDialogService } from '@nebular/theme';
import { ExpensesMutationComponent } from '../../@shared/expenses/expenses-mutation/expenses-mutation.component';
import { Store } from '../../@core/services/store.service';
import { ExpensesService } from '../../@core/services/expenses.service';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
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
import { NotesWithTagsComponent } from '../../@shared/table-components/notes-with-tags/notes-with-tags.component';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import { StatusBadgeComponent } from '../../@shared/status-badge/status-badge.component';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ToastrService } from '../../@core/services/toastr.service';
@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './expenses.component.html',
	styleUrls: ['./expenses.component.scss']
})
export class ExpensesComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	smartTableSettings: object;
	selectedEmployeeId: string;
	selectedDate: Date;
	smartTableSource = new LocalDataSource();
	expenses: IExpenseViewModel[];
	selectedExpense: IExpenseViewModel;
	showTable: boolean;
	employeeName: string;
	loading = true;
	hasEditPermission = false;
	viewComponentName: ComponentEnum;
	private _selectedOrganizationId: string;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	disableButton = true;
	averageExpense = 0;
	selectedOrganization: IOrganization;

	expensesTable: Ng2SmartTableComponent;
	@ViewChild('expensesTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.expensesTable = content;
			this.onChangedSource();
		}
	}

	constructor(
		private dialogService: NbDialogService,
		private store: Store,
		private expenseService: ExpensesService,
		private toastrService: ToastrService,
		private route: ActivatedRoute,
		private errorHandler: ErrorHandlingService,
		readonly translateService: TranslateService,
		private readonly router: Router
	) {
		super(translateService);
		this.setView();
	}

	async ngOnInit() {
		this.loadSettingsSmartTable();
		this._applyTranslationOnSmartTable();
		this.store.selectedDate$
			.pipe(untilDestroyed(this))
			.subscribe((date) => {
				this.selectedDate = date;
				if (this.selectedEmployeeId) {
					this._loadTableData();
				} else {
					if (this._selectedOrganizationId) {
						this._loadTableData();
					}
				}
			});
		const storeEmployee$ = this.store.selectedEmployee$;
		const storeOrganization$ = this.store.selectedOrganization$;
		storeEmployee$
			.pipe(
				filter((value) => !!value),
				debounceTime(200),
				withLatestFrom(storeOrganization$),
				untilDestroyed(this)
			)
			.subscribe(([employee]) => {
				if (employee && this.selectedOrganization) {
					this.selectedEmployeeId = employee.id;
					this._loadTableData();
				}
			});
		storeOrganization$
			.pipe(
				filter((value) => !!value),
				debounceTime(200),
				withLatestFrom(storeEmployee$),
				untilDestroyed(this)
			)
			.subscribe(([organization, employee]) => {
				if (organization) {
					this.selectedOrganization = organization;
					this._selectedOrganizationId = organization.id;
					this.selectedEmployeeId = employee ? employee.id : null;
					this._loadTableData();
				}
			});
		this.route.queryParamMap
			.pipe(
				filter((params) => !!params),
				debounceTime(1000),
				untilDestroyed(this)
			)
			.subscribe((params) => {
				if (params.get('openAddDialog') === 'true') {
					this.openAddExpenseDialog();
				}
			});
		this.router.events
			.pipe(untilDestroyed(this))
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
			.pipe(untilDestroyed(this))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
			});
	}

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.expensesTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this.clearItem())
			)
			.subscribe();
	}

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
				employee: {
					title: 'Employee',
					type: 'string',
					valuePrepareFunction: (_, expense: IExpenseViewModel) => {
						const user = expense.employee
							? expense.employee.user
							: null;
						if (user) {
							return `${user.firstName} ${user.lastName}`;
						}
					}
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
					type: 'custom',
					width: '5%',
					renderComponent: StatusBadgeComponent,
					valuePrepareFunction: (cell, row) => {
						const badgeclass = cell
							? ['paid'].includes(cell.toLowerCase())
								? 'success'
								: ['invoiced'].includes(cell.toLowerCase())
								? 'warning'
								: 'danger'
							: null;
						return {
							text: cell,
							class: badgeclass
						};
					}
				}
			}
		};
	}

	manageCategories() {
		this.router.navigate(['/pages/accounting/expenses/categories']);
	}

	getFormData(formData) {
		return {
			amount: formData.amount,
			category: formData.category,
			vendor: formData.vendor,
			typeOfExpense: formData.typeOfExpense,
			organizationContactId:
				formData.organizationContact.organizationContactId,
			organizationContactName: formData.organizationContact.name,
			projectId: formData.project.projectId,
			projectName: formData.project.name,
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
				organizationId: this.store.selectedOrganization.id,
				tenantId: this.store.selectedOrganization.tenantId
			});
			this.toastrService.success('NOTES.EXPENSES.ADD_EXPENSE', {
				name: formData.employee
					? `${formData.employee.firstName} ${formData.employee.lastName}`
					: this.getTranslation('SM_TABLE.EMPLOYEE')
			});
			this._loadTableData();
			this.clearItem();
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
			.onClose.pipe(untilDestroyed(this))
			.subscribe(async (formData) => {
				if (formData) {
					const completedForm = this.getFormData(formData);
					this.addExpense(completedForm, formData);
				}
			});
	}

	openEditExpenseDialog(selectedItem?: IExpense) {
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
			.onClose.pipe(untilDestroyed(this))
			.subscribe(async (formData) => {
				if (formData) {
					try {
						await this.expenseService.update(formData.id, {
							...this.getFormData(formData),
							employeeId: this.selectedExpense.employee
								? this.selectedExpense.employee.id
								: null
						});
						this.toastrService.success(
							'NOTES.EXPENSES.OPEN_EDIT_EXPENSE_DIALOG',
							{ name: this.employeeName }
						);

						this._loadTableData();
						this.clearItem();
					} catch (error) {
						this.errorHandler.handleError(error);
					}
				}
			});
	}

	openDuplicateExpenseDialog(selectedItem?: IExpense) {
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
			.onClose.pipe(untilDestroyed(this))
			.subscribe(async (formData) => {
				if (formData) {
					const completedForm = this.getFormData(formData);
					this.addExpense(completedForm, formData);
				}
			});
	}

	async deleteExpense(selectedItem?: IExpense) {
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
			.onClose.pipe(untilDestroyed(this))
			.subscribe(async (result) => {
				if (result) {
					try {
						await this.expenseService.delete(
							this.selectedExpense.id,
							this.selectedExpense.employee
								? this.selectedExpense.employee.id
								: null
						);
						this.toastrService.success(
							'NOTES.EXPENSES.DELETE_EXPENSE',
							{
								name: this.employeeName
							}
						);
						this._loadTableData();
						this.clearItem();
					} catch (error) {
						this.errorHandler.handleError(error);
					}
				}
			});
	}
	selectExpense({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedExpense = isSelected ? data : null;
	}

	private async _loadTableData() {
		const { tenantId, employeeId } = this.store.user;
		if (!this._selectedOrganizationId) {
			return;
		}
		this.showTable = false;
		const findObj = {
			organizationId: this._selectedOrganizationId,
			tenantId
		};
		if (this.selectedEmployeeId) {
			findObj['employeeId'] = this.selectedEmployeeId;
		}
		if (employeeId) {
			delete this.smartTableSettings['columns']['employee'];
			this.smartTableSettings = Object.assign(
				{},
				this.smartTableSettings
			);
		}

		try {
			const { items } = await this.expenseService.getAll(
				['employee', 'employee.user', 'category', 'vendor', 'tags'],
				findObj,
				this.selectedDate
			);
			const expenseVM: IExpenseViewModel[] = items.map((i) => {
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
					organizationContactId: i.organizationContactId,
					organizationContactName: i.organizationContactName,
					projectId: i.projectId,
					projectName: i.projectName,
					amount: i.amount,
					notes: i.notes,
					currency: i.currency,
					employee: i.employee,
					employeeName: i.employee?.user?.name,
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
			this.expenses = expenseVM;
			this.smartTableSource.load(expenseVM);
			this.showTable = true;
		} catch (error) {
			this.toastrService.danger('NOTES.EXPENSES.EXPENSES_ERROR', null, {
				error: error.error.message || error.message
			});
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
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.loadSettingsSmartTable();
			});
	}

	clearItem() {
		this.selectExpense({
			isSelected: false,
			data: null
		});
		this.deselectAll();
	}

	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.expensesTable && this.expensesTable.grid) {
			this.expensesTable.grid.dataSet['willSelect'] = 'false';
			this.expensesTable.grid.dataSet.deselectAll();
		}
	}

	ngOnDestroy() {}
}
