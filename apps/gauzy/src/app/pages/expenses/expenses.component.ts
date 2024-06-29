import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import {
	IExpense,
	ComponentLayoutStyleEnum,
	IOrganization,
	IEmployee,
	IOrganizationVendor,
	IExpenseCategory,
	IDateRangePicker,
	ExpenseStatusesEnum,
	PermissionsEnum
} from '@gauzy/contracts';
import { combineLatest, Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import moment from 'moment';
import { Cell } from 'angular2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { API_PREFIX, ComponentEnum, Store, distinctUntilChange, employeeMapper, toUTC } from '@gauzy/ui-core/common';
import {
	DateRangePickerBuilderService,
	ErrorHandlingService,
	ExpensesService,
	ServerDataSource,
	ToastrService
} from '@gauzy/ui-core/core';
import {
	ALL_EMPLOYEES_SELECTED,
	DateViewComponent,
	DeleteConfirmationComponent,
	EmployeeLinksComponent,
	ExpenseCategoryFilterComponent,
	ExpensesMutationComponent,
	IPaginationBase,
	IncomeExpenseAmountComponent,
	InputFilterComponent,
	PaginationFilterBaseComponent,
	ReplacePipe,
	StatusBadgeComponent,
	VendorFilterComponent,
	getAdjustDateRangeFutureAllowed
} from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './expenses.component.html',
	styleUrls: ['./expenses.component.scss']
})
export class ExpensesComponent extends PaginationFilterBaseComponent implements AfterViewInit, OnInit, OnDestroy {
	public smartTableSettings: object;
	public employeeId: string | null;
	public projectId: string | null;
	public selectedDateRange: IDateRangePicker;
	public smartTableSource: ServerDataSource;
	public expenses: IExpense[] = [];
	public selectedExpense: IExpense;
	public loading: boolean = false;
	public disableButton: boolean = true;
	public viewComponentName: ComponentEnum;
	public dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	public componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	public organization: IOrganization;
	public expenses$: Subject<any> = this.subject$;
	private _refresh$: Subject<any> = new Subject();

	constructor(
		private readonly dialogService: NbDialogService,
		private readonly store: Store,
		private readonly expenseService: ExpensesService,
		private readonly toastrService: ToastrService,
		private readonly route: ActivatedRoute,
		private readonly errorHandler: ErrorHandlingService,
		public readonly translateService: TranslateService,
		private readonly router: Router,
		private readonly httpClient: HttpClient,
		private readonly replacePipe: ReplacePipe,
		private readonly dateRangePickerBuilderService: DateRangePickerBuilderService
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this._loadSettingsSmartTable();
		this._applyTranslationOnSmartTable();

		// Combine all observables into one observable using combineLatest
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.store.selectedEmployee$;
		const selectedDateRange$ = this.dateRangePickerBuilderService.selectedDateRange$;
		const selectedProject$ = this.store.selectedProject$;

		// Subscribe to expenses$ and perform actions when it emits a value
		this.expenses$
			.pipe(
				// Introduce a debounce time of 100 milliseconds
				debounceTime(100),
				// Execute the _clearItem method
				tap(() => this._clearItem()),
				// Execute the getIncomes method
				tap(() => this.getExpenses()),
				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
		// Subscribe to expenses$ and perform actions when it emits a value
		this.expenses$
			.pipe(
				// Introduce a debounce time of 100 milliseconds
				debounceTime(100),
				// Execute the _clearItem method
				tap(() => this._clearItem()),
				// Execute the getIncomes method
				tap(() => this.getExpenses()),
				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
		// Subscribe to the combined latest values from the all observables
		combineLatest([storeOrganization$, selectedDateRange$, storeEmployee$, selectedProject$])
			.pipe(
				// Introduce a debounce time of 300 milliseconds
				debounceTime(300),
				// Filter out combinations where organization and dateRange are truthy
				filter(([organization, dateRange]) => !!organization && !!dateRange),
				// Only emit when there is a distinct change in the values
				distinctUntilChange(),
				// Perform actions when the combined values emit
				tap(([organization, dateRange, employee, project]) => {
					// Set component properties based on the emitted values
					this.organization = organization;
					this.selectedDateRange = dateRange;
					this.employeeId = employee ? employee.id : null;
					this.projectId = project ? project.id : null;
				}),
				// Trigger the _refresh$ and expenses$ observables
				tap(() => this._refresh$.next(true)),
				tap(() => this.expenses$.next(true)),
				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
		// Subscribe to changes in the query parameters
		this.route.queryParamMap
			.pipe(
				// Filter out null or undefined parameters
				filter((params: ParamMap) => !!params),
				// Check if 'openAddDialog' parameter is set to 'true'
				filter((params: ParamMap) => params.get('openAddDialog') === 'true'),
				// Add a debounce time to prevent rapid consecutive calls
				debounceTime(1000),
				// Open the add expense dialog
				tap(() => this.openAddExpenseDialog()),
				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
		// Subscribe to _refresh$ and perform actions when it emits a value
		this._refresh$
			.pipe(
				// Filter based on the condition that dataLayoutStyle is CARDS_GRID
				filter(() => this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID),
				// Execute the refreshPagination method
				tap(() => this.refreshPagination()),
				// Perform actions when the condition is met
				// Clear the incomes array
				tap(() => (this.expenses = [])),
				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit(): void {
		// Check if the user has the permission to change the selected employee
		if (this.store.user && !this.store.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			// If the user doesn't have the permission, remove the 'employee' column
			delete this.smartTableSettings['columns']['employee'];

			// Create a new object for smartTableSettings to trigger change detection
			this.smartTableSettings = { ...this.smartTableSettings };
		}
	}

	/**
	 * Sets the view component and handles layout changes.
	 */
	setView() {
		// Set the view component name
		this.viewComponentName = ComponentEnum.EXPENSES;

		// Subscribe to changes in the component layout
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout) => (this.dataLayoutStyle = componentLayout)),
				tap(() => this.refreshPagination()),
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => (this.expenses = [])),
				tap(() => this.expenses$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Maps an ExpenseStatusesEnum value to text and class properties.
	 *
	 * @param value - The ExpenseStatusesEnum value to map.
	 * @returns An object with text and class properties.
	 */
	private statusMapper = (value: ExpenseStatusesEnum): { text: string; class: string | null } => {
		let badgeClass: string | null = null;

		switch (value) {
			case ExpenseStatusesEnum.PAID:
				badgeClass = 'success';
				break;
			case ExpenseStatusesEnum.INVOICED:
				badgeClass = 'warning';
				break;
			default:
				badgeClass = 'danger';
		}

		return {
			text: this.replacePipe.transform(value, '_', ' '),
			class: badgeClass
		};
	};

	private _loadSettingsSmartTable() {
		const pagination: IPaginationBase = this.getPagination();
		this.smartTableSettings = {
			actions: false,
			selectedRowIndex: -1,
			editable: true,
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.EXPENSE'),
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
			columns: {
				valueDate: {
					title: this.getTranslation('SM_TABLE.DATE'),
					type: 'custom',
					width: '10%',
					filter: false,
					renderComponent: DateViewComponent,
					componentInitFunction: (instance: DateViewComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					}
				},
				vendorName: {
					title: this.getTranslation('SM_TABLE.VENDOR'),
					type: 'string',
					filter: {
						type: 'custom',
						component: VendorFilterComponent
					},
					filterFunction: (value: IOrganizationVendor) => {
						this.setFilter({ field: 'vendorId', search: value?.id || null });
					},
					sort: false
				},
				categoryName: {
					title: this.getTranslation('SM_TABLE.CATEGORY'),
					type: 'string',
					filter: {
						type: 'custom',
						component: ExpenseCategoryFilterComponent
					},
					filterFunction: (value: IExpenseCategory) => {
						this.setFilter({ field: 'categoryId', search: value?.id || null });
					},
					sort: false
				},
				employee: {
					title: this.getTranslation('SM_TABLE.EMPLOYEE'),
					filter: false,
					type: 'custom',
					sort: false,
					renderComponent: EmployeeLinksComponent,
					componentInitFunction: (instance: EmployeeLinksComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getRawValue();
					}
				},
				projectName: {
					title: this.getTranslation('SM_TABLE.PROJECT'),
					type: 'string',
					filter: false,
					sort: false
				},
				amount: {
					title: this.getTranslation('SM_TABLE.VALUE'),
					type: 'custom',
					width: '10%',
					filter: false,
					renderComponent: IncomeExpenseAmountComponent,
					componentInitFunction: (instance: IncomeExpenseAmountComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					}
				},
				notes: {
					title: this.getTranslation('SM_TABLE.NOTES'),
					type: 'text',
					class: 'align-row',
					filter: {
						type: 'custom',
						component: InputFilterComponent
					},
					filterFunction: (value: string) => {
						this.setFilter({ field: 'notes', search: value });
					}
				},
				purpose: {
					title: this.getTranslation('POP_UPS.PURPOSE'),
					type: 'string',
					class: 'align-row',
					filter: {
						type: 'custom',
						component: InputFilterComponent
					},
					filterFunction: (value: string) => {
						this.setFilter({ field: 'purpose', search: value });
					}
				},
				statuses: {
					title: this.getTranslation('SM_TABLE.STATUS'),
					type: 'custom',
					width: '5%',
					filter: false,
					renderComponent: StatusBadgeComponent,
					componentInitFunction: (instance: StatusBadgeComponent, cell: Cell) => {
						instance.value = cell.getRawValue();
					}
				}
			}
		};
	}

	/**
	 * Navigates to the category management page for expenses.
	 */
	manageCategories(): void {
		// You can add comments here if needed
		this.router.navigate(['/pages/accounting/expenses/categories']);
	}

	/**
	 * Adds an expense.
	 *
	 * @param expense - The expense to be added.
	 */
	async addExpense(expense: IExpense): Promise<void> {
		try {
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;
			const { employee } = expense;

			// Create the expense using the expense service
			await this.expenseService.create({
				...expense,
				valueDate: moment(expense.valueDate).startOf('day').toDate(),
				employeeId: employee ? employee.id : null,
				organizationId,
				tenantId
			});

			// Show success toast and refresh components
			this.toastrService.success('NOTES.EXPENSES.ADD_EXPENSE', {
				name: this.employeeName(employee)
			});
			this.dateRangePickerBuilderService.refreshDateRangePicker(moment(expense.valueDate));
		} catch (error) {
			// Handle errors and show danger toast
			this.errorHandler.handleError(error);
		} finally {
			// Trigger a refresh of data
			this._refresh$.next(true);
			this.expenses$.next(true);
		}
	}

	/**
	 * Opens a dialog for adding a new expense.
	 */
	openAddExpenseDialog(): void {
		// Open a dialog for adding expense
		const addDialogRef = this.dialogService.open(ExpensesMutationComponent);

		// Subscribe to the dialog result
		addDialogRef.onClose.pipe(untilDestroyed(this)).subscribe(async (newExpense: IExpense) => {
			// If a new expense is returned from the dialog
			if (newExpense) {
				// Call the addExpense method to handle the addition
				await this.addExpense(newExpense);
			}
		});
	}

	/**
	 * Opens a dialog for editing an expense.
	 *
	 * @param selectedItem - The expense to be edited.
	 */
	openEditExpenseDialog(selectedItem?: IExpense): void {
		if (selectedItem) {
			this.selectExpense({
				isSelected: true,
				data: selectedItem
			});
		}

		// Open a dialog for editing the expense
		const editDialogRef = this.dialogService.open(ExpensesMutationComponent, {
			context: {
				expense: this.selectedExpense
			}
		});

		// Subscribe to the dialog result
		editDialogRef.onClose.pipe(untilDestroyed(this)).subscribe(async (editedExpense: IExpense) => {
			if (editedExpense) {
				try {
					// Check if a valid expense is selected
					if (!this.selectedExpense) {
						return;
					}

					const { tenantId } = this.store.user;
					const { id: organizationId } = this.organization;
					const { id, employee } = this.selectedExpense;

					// Update the expense using the expense service
					await this.expenseService.update(id, {
						...editedExpense,
						valueDate: moment(editedExpense.valueDate).startOf('day').toDate(),
						employeeId: employee ? employee.id : null,
						tenantId,
						organizationId
					});

					// Refresh the date range picker and show success toast
					this.dateRangePickerBuilderService.refreshDateRangePicker(moment(editedExpense.valueDate));
					this.toastrService.success('NOTES.EXPENSES.OPEN_EDIT_EXPENSE_DIALOG', {
						name: this.employeeName(employee)
					});
				} catch (error) {
					// Handle any errors that occur during the update
					this.errorHandler.handleError(error);
				} finally {
					// Trigger a refresh of data
					this._refresh$.next(true);
					this.expenses$.next(true);
				}
			}
		});
	}

	/**
	 * Opens a dialog for duplicating the selected expense.
	 *
	 * @param selectedItem - The selected expense to be duplicated.
	 */
	openDuplicateExpenseDialog(selectedItem?: IExpense): void {
		// If an expense is selected, update the selected expense
		if (selectedItem) {
			this.selectExpense({
				isSelected: true,
				data: selectedItem
			});
		}

		// Open a dialog for duplicating expense
		const duplicateDialogRef = this.dialogService.open(ExpensesMutationComponent, {
			context: {
				expense: this.selectedExpense,
				duplicate: true
			}
		});

		// Subscribe to the dialog result
		duplicateDialogRef.onClose.pipe(untilDestroyed(this)).subscribe(async (duplicatedExpense: IExpense) => {
			// If a duplicated expense is returned from the dialog
			if (duplicatedExpense) {
				// Check if there is a selected expense
				if (!this.selectedExpense) {
					return;
				}

				// Call the addExpense method to handle the duplication
				await this.addExpense(duplicatedExpense);
			}
		});
	}

	/**
	 * Deletes the selected expense.
	 *
	 * @param selectedItem - The selected expense to be deleted.
	 */
	async deleteExpense(selectedItem?: IExpense): Promise<void> {
		// If an expense is selected, update the selected expense
		if (selectedItem) {
			this.selectExpense({
				isSelected: true,
				data: selectedItem
			});
		}

		// Open a confirmation dialog
		const confirmationDialogRef = this.dialogService.open(DeleteConfirmationComponent, {
			context: {
				recordType: this.getTranslation('FORM.DELETE_CONFIRMATION.EXPENSE')
			}
		});

		// Subscribe to the dialog result
		confirmationDialogRef.onClose.pipe(untilDestroyed(this)).subscribe(async (dialogResult) => {
			// If the user confirmed the deletion
			if (dialogResult) {
				try {
					// Check if there is a selected expense
					if (!this.selectedExpense) {
						return;
					}

					const { id: organizationId, tenantId } = this.organization;
					// Extract necessary information from the selected expense
					const { id, employee, employeeId } = this.selectedExpense;

					// Delete the expense
					await this.expenseService.delete(id, {
						employeeId,
						organizationId,
						tenantId
					});

					// Display success message
					this.toastrService.success('NOTES.EXPENSES.DELETE_EXPENSE', {
						name: this.employeeName(employee)
					});
				} catch (error) {
					// Handle errors
					this.errorHandler.handleError(error);
				} finally {
					// Trigger refresh for the data and expenses
					this._refresh$.next(true);
					this.expenses$.next(true);
				}
			}
		});
	}

	/**
	 * Handles the selection of an expense item.
	 *
	 * @param {Object} param - Destructured parameter object.
	 *                        - isSelected: A boolean indicating whether the item is selected.
	 *                        - data: The expense data associated with the selected item.
	 */
	selectExpense({ isSelected, data }: { isSelected: boolean; data: IExpense }): void {
		// Update the disableButton property based on the isSelected value
		this.disableButton = !isSelected;

		// Update the selectedExpense property based on the isSelected value
		this.selectedExpense = isSelected ? data : null;
	}

	/**
	 * Registers Smart Table Source Config for expenses.
	 */
	setSmartTableSource(): void {
		if (!this.organization) {
			return;
		}

		// Extract necessary information from the store, organization, and selected date range
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const { startDate, endDate } = getAdjustDateRangeFutureAllowed(this.selectedDateRange);

		// Create a new ServerDataSource for expenses
		this.smartTableSource = new ServerDataSource(this.httpClient, {
			endPoint: `${API_PREFIX}/expense/pagination`,
			relations: ['employee', 'employee.user', 'category', 'vendor', 'tags', 'project', 'organizationContact'],
			where: {
				organizationId,
				tenantId,
				...(this.employeeId ? { employeeId: this.employeeId } : {}),
				...(this.projectId ? { projectId: this.projectId } : {}),
				valueDate: {
					startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm:ss'),
					endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm:ss')
				},
				...(this.filters.where ? this.filters.where : {})
			},
			resultMap: (expense: IExpense): any => ({
				...expense,
				vendorName: expense.vendor ? expense.vendor.name : null,
				categoryName: expense.category ? expense.category.name : null,
				projectName: expense.project ? expense.project.name : null,
				statuses: this.statusMapper(expense.status),
				employee: { ...employeeMapper(expense) }
			}),
			finalize: () => {
				// Handle finalization logic, such as updating the UI and pagination
				if (this.dataLayoutStyle === this.componentLayoutStyleEnum.CARDS_GRID) {
					this.expenses.push(...this.smartTableSource.getData());
				}
				this.setPagination({
					...this.getPagination(),
					totalItems: this.smartTableSource.count()
				});
				this.loading = false;
			}
		});
	}

	/**
	 * Fetches and initializes expenses data based on the selected organization and pagination settings.
	 * If the organization is not available, the method returns early.
	 * Handles the retrieval of expenses data and updates the Smart Table source accordingly.
	 */
	private async getExpenses() {
		// Check if the organization is available
		if (!this.organization) {
			return;
		}

		try {
			// Set up the Smart Table source
			this.setSmartTableSource();

			// Retrieve pagination settings
			const { activePage, itemsPerPage } = this.getPagination();

			// Set the paging configuration for the Smart Table source
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);

			// Fetch elements if the data layout style is set to cards grid
			if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {
				await this.smartTableSource.getElements();
			}
		} catch (error) {
			// Handle errors and display a danger toast notification
			this.toastrService.danger('NOTES.EXPENSES.EXPENSES_ERROR', null, {
				error: error.error.message || error.message
			});
		}
	}

	/**
	 * Subscribe to the language change event and apply translations to the Smart Table.
	 * Calls the _loadSettingsSmartTable method when the language changes.
	 */
	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSettingsSmartTable()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Clears the selected expense.
	 */
	private _clearItem() {
		this.selectExpense({
			isSelected: false,
			data: null
		});
	}

	/**
	 * Gets the name of an employee.
	 * @param employee - The employee for which to retrieve the name.
	 * @returns The full name of the employee or the first name of the default employee if not available.
	 */
	employeeName(employee: IEmployee): string {
		return employee && employee.id ? employee.fullName.trim() : ALL_EMPLOYEES_SELECTED.firstName;
	}

	ngOnDestroy() {}
}
