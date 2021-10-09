import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import {
	IExpense,
	ComponentLayoutStyleEnum,
	IOrganization,
	IExpenseViewModel,
	IEmployee,
	IOrganizationVendor,
	IExpenseCategory
} from '@gauzy/contracts';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Subject } from 'rxjs';
import { combineLatest } from 'rxjs';
import { distinctUntilChange, isNotEmpty } from '@gauzy/common-angular';
import * as moment from 'moment';
import { Ng2SmartTableComponent } from 'ng2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { ExpensesMutationComponent } from '../../@shared/expenses/expenses-mutation/expenses-mutation.component';
import { DeleteConfirmationComponent } from '../../@shared/user/forms';
import {
	DateViewComponent,
	IncomeExpenseAmountComponent,
	NotesWithTagsComponent
} from '../../@shared/table-components';
import { PaginationFilterBaseComponent } from '../../@shared/pagination/pagination-filter-base.component';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import { StatusBadgeComponent } from '../../@shared/status-badge';
import { API_PREFIX } from '../../@core/constants';
import { ServerDataSource } from '../../@core/utils/smart-table/server.data-source';
import { ALL_EMPLOYEES_SELECTED } from '../../@theme/components/header/selectors/employee';
import { ErrorHandlingService, ExpensesService, Store, ToastrService } from '../../@core/services';
import { ExpenseCategoryFilterComponent, VendorFilterComponent } from '../../@shared/table-filters';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './expenses.component.html',
	styleUrls: ['./expenses.component.scss']
})
export class ExpensesComponent
	extends PaginationFilterBaseComponent
	implements AfterViewInit, OnInit, OnDestroy {

	smartTableSettings: object;
	employeeId: string | null;
	projectId: string | null;
	selectedDate: Date;
	smartTableSource: ServerDataSource;
	expenses: IExpenseViewModel[];
	selectedExpense: IExpenseViewModel;
	loading: boolean;
	hasEditPermission = false;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	disableButton = true;
	organization: IOrganization;
	subject$: Subject<any> = new Subject();

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
		private readonly httpClient: HttpClient
	) {
		super(translateService);
		this.setView();
	}

	async ngOnInit() {
		this._loadSettingsSmartTable();
		this._applyTranslationOnSmartTable();
		this.subject$
			.pipe(
				tap(() => this.loading = true),
				debounceTime(300),
				tap(() => this.clearItem()),
				tap(() => this.getExpenses()),
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.store.selectedEmployee$;
		const selectedDate$ = this.store.selectedDate$;
		const selectedProject$ = this.store.selectedProject$;
		combineLatest([storeOrganization$, storeEmployee$, selectedDate$, selectedProject$])
			.pipe(
				debounceTime(300),
				filter(([organization]) => !!organization),
				tap(([organization]) => (this.organization = organization)),
				distinctUntilChange(),
				tap(([organization, employee, date, project]) => {
					if (organization) {
						this.selectedDate = date;
						this.employeeId = employee ? employee.id : null;
						this.projectId = project ? project.id : null;
						
						this.refreshPagination();
						this.subject$.next(true);
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this.route.queryParamMap
			.pipe(
				filter((params) => !!params && params.get('openAddDialog') === 'true'),
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
				tap(() => this.subject$.next(true)),
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
				tap(() => this.clearItem())
			)
			.subscribe();
	}

	private statusMapper = (value: string) => {
		const badgeclass = value
			? ['paid'].includes(value.toLowerCase())
				? 'success'
				: ['invoiced'].includes(value.toLowerCase())
				? 'warning'
				: 'danger'
			: null;
		return {
			text: value,
			class: badgeclass
		};
	}

	_loadSettingsSmartTable() {
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
				employeeName: {
					title: this.getTranslation('SM_TABLE.EMPLOYEE'),
					type: 'string',
					filter: false,
					sort: false
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
					title: 'Purpose',
					type: 'custom',
					class: 'align-row',
					renderComponent: NotesWithTagsComponent
				},
				status: {
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

	getFormData(data) {
		const { 
			amount,
			category,
			vendor,
			typeOfExpense,
			organizationContact = null,
			project = null,
			valueDate,
			notes,
			currency,
			purpose,
			taxType,
			taxLabel,
			rateValue,
			receipt,
			splitExpense,
			tags,
			status
		} = data;
		return {
			amount,
			category,
			vendor,
			typeOfExpense,
			organizationContactId: (organizationContact) ? organizationContact.organizationContactId : null,
			projectId: (project) ? project.projectId : null,
			valueDate,
			notes,
			currency,
			purpose,
			taxType,
			taxLabel,
			rateValue,
			receipt,
			splitExpense,
			tags,
			status
		};
	}

	async addExpense(completedForm, formData) {
		try {
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;
			const { employee } = formData;

			await this.expenseService.create({
				...completedForm,
				employeeId: employee ? employee.id : null,
				organizationId,
				tenantId
			}).then(() => {
				this.subject$.next(true);
				this.toastrService.success('NOTES.EXPENSES.ADD_EXPENSE', {
					name: this.employeeName(employee)
				});
			});
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
			.subscribe(async (data) => {
				if (data) {
					const completedForm = this.getFormData(data);
					await this.addExpense(completedForm, data);
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
			.subscribe(async (data) => {
				if (data) {
					try {
						if (!this.selectedExpense) {
							return;
						}
						const { id, employee } = this.selectedExpense;
						await this.expenseService.update(id, {
							...this.getFormData(data),
							employeeId: employee ? employee.id : null
						}).then(() => {
							this.subject$.next(true);
							this.toastrService.success('NOTES.EXPENSES.OPEN_EDIT_EXPENSE_DIALOG', { 
								name: this.employeeName(employee) 
							});
						});
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
					if (!this.selectedExpense) {
						return;
					}
					const completedForm = this.getFormData(formData);
					await this.addExpense(completedForm, formData);
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
						).then(() => {
							this.subject$.next(true);
							this.toastrService.success('NOTES.EXPENSES.DELETE_EXPENSE', { 
								name: this.employeeName(employee) 
							});
						});
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
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const request = {};
		if (this.employeeId) { request['employeeId'] = this.employeeId; }
		if (this.projectId) { request['projectId'] = this.projectId; }
		if (moment(this.selectedDate).isValid()) {
			request['valueDate'] = moment(this.selectedDate).format('YYYY-MM-DD HH:mm:ss');
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
					employeeName: expense.employee ? expense.employee.fullName : null,
					vendorName: expense.vendor ? expense.vendor.name : null,
					categoryName: expense.category ? expense.category.name : null,
					projectName: expense.project ? expense.project.name : null,
					status: this.statusMapper(expense.status)
				});
			},
			finalize: () => {
				this.loading = false;
			}
		});
	}

	private async getExpenses() {
		try { 
			this.setSmartTableSource();
			if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {

				// Initiate GRID view pagination
				const { activePage, itemsPerPage } = this.pagination;
				this.smartTableSource.setPaging(activePage, itemsPerPage, false);

				await this.smartTableSource.getElements();
				this.expenses = this.smartTableSource.getData();

				this.pagination['totalItems'] =  this.smartTableSource.count();
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

	employeeName(employee: IEmployee) {
		return (
			employee && employee.id
		) ? (employee.fullName).trim() : ALL_EMPLOYEES_SELECTED.firstName;
	}

	ngOnDestroy() {}
}
