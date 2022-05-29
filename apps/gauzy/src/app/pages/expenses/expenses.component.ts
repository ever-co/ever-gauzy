import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import {
	IExpense,
	ComponentLayoutStyleEnum,
	IOrganization,
	IExpenseViewModel,
	IEmployee,
	IOrganizationVendor,
	IExpenseCategory,
	IDateRangePicker,
	ExpenseStatusesEnum
} from '@gauzy/contracts';
import { combineLatest, Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange, employeeMapper, isNotEmpty, toUTC } from '@gauzy/common-angular';
import * as moment from 'moment';
import { Ng2SmartTableComponent } from 'ng2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { ExpensesMutationComponent } from '../../@shared/expenses/expenses-mutation/expenses-mutation.component';
import { DeleteConfirmationComponent } from '../../@shared/user/forms';
import {
	DateViewComponent,
	EmployeeLinksComponent,
	IncomeExpenseAmountComponent,
	NotesWithTagsComponent
} from '../../@shared/table-components';
import {
	ExpenseCategoryFilterComponent,
	VendorFilterComponent
} from '../../@shared/table-filters';
import { IPaginationBase, PaginationFilterBaseComponent } from '../../@shared/pagination/pagination-filter-base.component';
import { StatusBadgeComponent } from '../../@shared/status-badge';
import { API_PREFIX, ComponentEnum } from '../../@core/constants';
import { ServerDataSource } from '../../@core/utils/smart-table';
import { ALL_EMPLOYEES_SELECTED } from '../../@theme/components/header/selectors/employee';
import {
	ErrorHandlingService,
	ExpensesService,
	Store,
	ToastrService
} from '../../@core/services';
import { getAdjustDateRangeFutureAllowed } from '../../@theme/components/header/selectors/date-range-picker';
import { ReplacePipe } from '../../@shared/pipes';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './expenses.component.html',
	styleUrls: ['./expenses.component.scss']
})
export class ExpensesComponent extends PaginationFilterBaseComponent
	implements AfterViewInit, OnInit, OnDestroy {

	smartTableSettings: object;
	employeeId: string | null;
	projectId: string | null;
	selectedDateRange: IDateRangePicker;
	smartTableSource: ServerDataSource;
	expenses: IExpenseViewModel[] = [];
	selectedExpense: IExpenseViewModel;
	loading: boolean = false;
	disableButton: boolean = true;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;

	organization: IOrganization;
	expenses$: Subject<any> = this.subject$;

	expensesTable: Ng2SmartTableComponent;
	@ViewChild('expensesTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.expensesTable = content;
			this.onChangedSource();
		}
	}

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
		private readonly replacePipe: ReplacePipe
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this._loadSettingsSmartTable();
		this._applyTranslationOnSmartTable();
		this.expenses$
			.pipe(
				debounceTime(100),
				tap(() => this._clearItem()),
				tap(() => this.getExpenses()),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this.expenses$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.store.selectedEmployee$;
		const selectedDateRange$ = this.store.selectedDateRange$;
		const selectedProject$ = this.store.selectedProject$;
		combineLatest([storeOrganization$, storeEmployee$, selectedDateRange$, selectedProject$])
			.pipe(
				debounceTime(300),
				filter(([organization]) => !!organization),
				distinctUntilChange(),
				tap(([organization, employee, dateRange, project]) => {
					this.organization = organization;
					this.selectedDateRange = dateRange;
					this.employeeId = employee ? employee.id : null;
					this.projectId = project ? project.id : null;
				}),
				tap(() => this.refreshPagination()),
				tap(() => this.expenses$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.route.queryParamMap
			.pipe(
				filter((params: ParamMap) => !!params),
				filter((params: ParamMap) => params.get('openAddDialog') === 'true'),
				debounceTime(1000),
				tap(() => this.openAddExpenseDialog()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		const { employeeId } = this.store.user;
		if (employeeId) {
			delete this.smartTableSettings['columns']['employeeName'];
			this.smartTableSettings = Object.assign({}, this.smartTableSettings);
		}
	}

	setView() {
		this.viewComponentName = ComponentEnum.EXPENSES;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout) => this.dataLayoutStyle = componentLayout),
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => this.refreshPagination()),
				tap(() => this.expenses$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.expensesTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this._clearItem())
			)
			.subscribe();
	}

	private statusMapper = (value: ExpenseStatusesEnum) => {
		const badgeClass = value
			? [ExpenseStatusesEnum.PAID].includes(value)
				? 'success'
				: [ExpenseStatusesEnum.INVOICED].includes(value)
				? 'warning'
				: 'danger'
			: null;
		return {
			text: this.replacePipe.transform(value, '_', ' '),
			class: badgeClass
		};
	}

	private _loadSettingsSmartTable() {
		const pagination: IPaginationBase = this.getPagination();
		this.smartTableSettings = {
			actions: false,
			editable: true,
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA'),
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
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
					type: 'string',
					filter: {
						type: 'custom',
						component: VendorFilterComponent
					},
					filterFunction: (value: IOrganizationVendor) => {
						this.setFilter({ field: 'vendorId', search: (value)?.id || null });
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
						this.setFilter({ field: 'categoryId', search: (value)?.id || null });
					},
					sort: false
				},
				employee: {
					title: this.getTranslation('SM_TABLE.EMPLOYEE'),
					filter: false,
					type: 'custom',
					sort: false,
					renderComponent: EmployeeLinksComponent
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
					renderComponent: IncomeExpenseAmountComponent
				},
				notes: {
					title: this.getTranslation('SM_TABLE.NOTES'),
					type: 'string'
				},
				purpose: {
					title:  this.getTranslation('POP_UPS.PURPOSE'),
					type: 'custom',
					class: 'align-row',
					renderComponent: NotesWithTagsComponent
				},
				statuses: {
					title: this.getTranslation('SM_TABLE.STATUS'),
					type: 'custom',
					width: '5%',
					filter: false,
					renderComponent: StatusBadgeComponent
				}
			}
		};
	}

	manageCategories() {
		this.router.navigate(['/pages/accounting/expenses/categories']);
	}

	async addExpense(expense: IExpense) {
		try {
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;
			const { employee } = expense;

			await this.expenseService.create({
				...expense,
				employeeId: employee ? employee.id : null,
				organizationId,
				tenantId
			});
			this.toastrService.success('NOTES.EXPENSES.ADD_EXPENSE', {
				name: this.employeeName(employee)
			});
			this.expenses$.next(true);
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	}

	openAddExpenseDialog() {
		this.dialogService
			.open(ExpensesMutationComponent)
			.onClose
			.pipe(untilDestroyed(this))
			.subscribe(async (expense: IExpense) => {
				if (expense) {
					await this.addExpense(expense);
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
			.onClose
			.pipe(untilDestroyed(this))
			.subscribe(async (expense: IExpense) => {
				if (expense) {
					try {
						if (!this.selectedExpense) {
							return;
						}
						const { tenantId } = this.store.user;
						const { id: organizationId } = this.organization;
						const { id, employee } = this.selectedExpense;

						await this.expenseService.update(id, {
							...expense,
							employeeId: employee ? employee.id : null,
							tenantId,
							organizationId
						});
						this.toastrService.success('NOTES.EXPENSES.OPEN_EDIT_EXPENSE_DIALOG', {
							name: this.employeeName(employee)
						});
						this.expenses$.next(true);
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
	
		this.dialogService
			.open(ExpensesMutationComponent, {
				context: {
					expense: this.selectedExpense,
					duplicate: true
				}
			})
			.onClose.pipe(untilDestroyed(this))
			.subscribe(async (expense: IExpense) => {
				if (expense) {
					if (!this.selectedExpense) {
						return;
					}
					await this.addExpense(expense);
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
						if (!this.selectedExpense) {
							return;
						}
						const { id, employee } = this.selectedExpense;
						await this.expenseService.delete(
							id,
							isNotEmpty(employee) ? employee.id : null
						);
						this.toastrService.success('NOTES.EXPENSES.DELETE_EXPENSE', {
							name: this.employeeName(employee)
						});
						this.expenses$.next(true);
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

	/*
	* Register Smart Table Source Config
	*/
	setSmartTableSource() {
		if (!this.organization) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const request = {};
		if (this.employeeId) { request['employeeId'] = this.employeeId; }
		if (this.projectId) { request['projectId'] = this.projectId; }

		const { startDate, endDate } = getAdjustDateRangeFutureAllowed(this.selectedDateRange);
		if (startDate && endDate) {
			request['valueDate'] = {};
			if (moment(startDate).isValid()) {
				request['valueDate']['startDate'] = toUTC(startDate).format('YYYY-MM-DD HH:mm:ss');
			}
			if (moment(endDate).isValid()) {
				request['valueDate']['endDate'] = toUTC(endDate).format('YYYY-MM-DD HH:mm:ss');
			}
		}
		
		this.smartTableSource = new ServerDataSource(this.httpClient, {
			endPoint: `${API_PREFIX}/expense/pagination`,
			relations: [
				'employee',
				'employee.user',
				'category',
				'vendor',
				'tags',
				'project',
				'organizationContact'
			],
			join: {
				...(this.filters.join) ? this.filters.join : {}
			},
			where: {
				...{ organizationId, tenantId },
				...request,
				...this.filters.where
			},
			resultMap: (expense: IExpense) => {
				return Object.assign({}, expense, {
					vendorName: expense.vendor ? expense.vendor.name : null,
					categoryName: expense.category ? expense.category.name : null,
					projectName: expense.project ? expense.project.name : null,
					statuses: this.statusMapper(expense.status),
					employee: { ... employeeMapper(expense) }
				});
			},
			finalize: () => {
				this.setPagination({
					...this.getPagination(),
					totalItems: this.smartTableSource.count()
				});
				this.loading = false;
			}
		});
	}

	private async getExpenses() {
		if (!this.organization) {
			return;
		}
		try {
			this.setSmartTableSource();

			const { activePage, itemsPerPage } = this.getPagination();
			this.smartTableSource.setPaging(
				activePage,
				itemsPerPage,
				false
			);

			if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {
				await this.smartTableSource.getElements();
				this.expenses = this.smartTableSource.getData();

				this.setPagination({
					...this.getPagination(),
					totalItems: this.smartTableSource.count()
				});
			}
		} catch (error) {
			this.toastrService.danger('NOTES.EXPENSES.EXPENSES_ERROR', null, {
				error: error.error.message || error.message
			});
		}
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
	private _clearItem() {
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

	employeeName(employee: IEmployee) {
		return (
			employee && employee.id
		) ? (employee.fullName).trim() : ALL_EMPLOYEES_SELECTED.firstName;
	}

	ngOnDestroy() {}
}
