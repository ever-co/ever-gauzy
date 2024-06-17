import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { combineLatest, firstValueFrom, Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	DateRangePickerBuilderService,
	EmployeeRecurringExpenseService,
	EmployeesService,
	ToastrService,
	monthNames
} from '@gauzy/ui-core/core';
import {
	IOrganization,
	RecurringExpenseDefaultCategoriesEnum,
	RecurringExpenseDeletionEnum,
	IEmployeeRecurringExpense,
	IEmployee,
	IDateRangePicker,
	ComponentType
} from '@gauzy/contracts';
import { Store, distinctUntilChange, toUTC } from '@gauzy/ui-core/common';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { RecurringExpenseMutationComponent, RecurringExpenseDeleteConfirmationComponent } from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-recurring-expenses-employee',
	templateUrl: './recurring-expense-employee.component.html',
	styleUrls: ['./recurring-expense-employee.component.scss']
})
export class RecurringExpensesEmployeeComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	selectedEmployee: IEmployee;
	selectedDateRange: IDateRangePicker;
	recurringExpenses: IEmployeeRecurringExpense[] = [];
	employeeName = this.getTranslation('EMPLOYEES_PAGE.EMPLOYEE_NAME');
	fetchedHistories: any = {};
	organization: IOrganization;
	selectedEmployeeId: string;

	loading: boolean;
	expenses$: Subject<any> = new Subject();

	selectedRecurringExpense = {
		isSelected: false,
		data: null,
		index: null
	};

	showHistory: boolean = false;

	constructor(
		private readonly route: ActivatedRoute,
		private readonly employeeService: EmployeesService,
		private readonly store: Store,
		private readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		private readonly dialogService: NbDialogService,
		private readonly employeeRecurringExpenseService: EmployeeRecurringExpenseService,
		private readonly toastrService: ToastrService,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.expenses$
			.pipe(
				debounceTime(300),
				tap(() => this._loadEmployeeRecurringExpense()),
				untilDestroyed(this)
			)
			.subscribe();
		const selectedOrganization$ = this.store.selectedOrganization$;
		const selectedEmployee$ = this.store.selectedEmployee$;
		const selectedDateRange$ = this.dateRangePickerBuilderService.selectedDateRange$;
		combineLatest([selectedOrganization$, selectedDateRange$, selectedEmployee$])
			.pipe(
				debounceTime(300),
				distinctUntilChange(),
				filter(([organization, dateRange]) => !!organization && !!dateRange),
				tap(([organization, dateRange, employee]) => {
					this.organization = organization;
					this.selectedDateRange = dateRange;
					this.selectedEmployeeId = employee ? employee.id : null;
				}),
				tap(() => this.expenses$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.route.params
			.pipe(
				filter((params: Params) => !!params && !!params.id),
				tap((params: Params) => this.getSelectedEmployee(params.id)),
				untilDestroyed(this)
			)
			.subscribe();
		this.route.queryParamMap
			.pipe(
				filter((params: Params) => !!params),
				filter((params: Params) => params.get('openAddDialog') === 'true'),
				debounceTime(1000),
				tap(() => this.addEmployeeRecurringExpense()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 *
	 */
	async getSelectedEmployee(employeeId: string) {
		this.selectedEmployee = await firstValueFrom(
			this.employeeService.getEmployeeById(employeeId, ['user', 'organizationPosition', 'tags', 'skills'])
		);
		this.store.selectedEmployee = {
			id: this.selectedEmployee.id,
			firstName: this.selectedEmployee.user.firstName,
			lastName: this.selectedEmployee.user.lastName,
			imageUrl: this.selectedEmployee.user.imageUrl,
			tags: this.selectedEmployee.user.tags,
			skills: this.selectedEmployee.skills
		};
		const checkUsername = this.selectedEmployee.user.username;
		this.employeeName = checkUsername ? checkUsername : this.getTranslation('EMPLOYEES_PAGE.EMPLOYEE_NAME');
	}

	getMonthString(month: number) {
		return monthNames[month];
	}

	getCategoryName(categoryName: string) {
		return categoryName in RecurringExpenseDefaultCategoriesEnum
			? this.getTranslation(`EXPENSES_PAGE.DEFAULT_CATEGORY.${categoryName}`)
			: categoryName;
	}

	async addEmployeeRecurringExpense() {
		// TODO get currency from the page dropdown
		const result = await firstValueFrom(
			this.dialogService.open(RecurringExpenseMutationComponent, {
				context: {
					componentType: ComponentType.EMPLOYEE
				}
			}).onClose
		);
		if (result) {
			try {
				const employeeRecurringExpense = this._recurringExpenseMutationResultTransform(result);
				await this.employeeRecurringExpenseService
					.create(employeeRecurringExpense)
					.then(() => {
						this.toastrService.success('TOASTR.MESSAGE.RECURRING_EXPENSE_SET', {
							name: this.employeeName
						});
						this._loadEmployeeRecurringExpense();
					})
					.catch((error) => {
						this.toastrService.danger(error);
					});
			} catch (error) {
				this.toastrService.danger(error);
			}
		}
	}

	async editEmployeeRecurringExpense() {
		const result = await firstValueFrom(
			this.dialogService.open(RecurringExpenseMutationComponent, {
				// TODO
				context: {
					recurringExpense: this.selectedRecurringExpense.data,
					componentType: ComponentType.EMPLOYEE
				}
			}).onClose
		);

		if (result) {
			try {
				const id = this.selectedRecurringExpense.data.id;
				const employeeRecurringExpense = this._recurringExpenseMutationResultTransform(result);
				this.employeeRecurringExpenseService
					.update(id, employeeRecurringExpense)
					.then(() => {
						this.toastrService.success('TOASTR.MESSAGE.RECURRING_EXPENSE_UPDATED', {
							name: this.employeeName
						});
						this._loadEmployeeRecurringExpense();
					})
					.catch((error) => {
						this.toastrService.danger(error);
					});
			} catch (error) {
				this.toastrService.danger(error);
			}
		}
	}

	async deleteEmployeeRecurringExpense() {
		const startDate = new Date(this.selectedDateRange.startDate);
		const selectedExpense = this.selectedRecurringExpense.data;
		const result: RecurringExpenseDeletionEnum = await firstValueFrom(
			this.dialogService.open(RecurringExpenseDeleteConfirmationComponent, {
				context: {
					recordType: this.getTranslation('EMPLOYEES_PAGE.RECURRING_EXPENSE'),
					start: `${this.getMonthString(selectedExpense.startMonth)}, ${selectedExpense.startYear}`,
					current: `${this.getMonthString(startDate.getMonth())}, ${startDate.getFullYear()}`,
					end: selectedExpense.endMonth
						? `${this.getMonthString(selectedExpense.endMonth)}, ${selectedExpense.endYear}`
						: 'end'
				}
			}).onClose
		);
		if (result) {
			try {
				const id = selectedExpense.id;
				this.employeeRecurringExpenseService
					.delete(id, {
						deletionType: result,
						month: startDate.getMonth(),
						year: startDate.getFullYear()
					})
					.then(() => {
						this.toastrService.success('TOASTR.MESSAGE.RECURRING_EXPENSE_DELETED', {
							name: this.employeeName
						});
						this._loadEmployeeRecurringExpense();
					})
					.catch((error) => {
						this.toastrService.danger(error);
					});
			} catch (error) {
				this.toastrService.danger(error);
			}
		}
	}

	private _recurringExpenseMutationResultTransform(result): IEmployeeRecurringExpense {
		if (!this.organization) {
			return;
		}

		const { startDate } = this.selectedDateRange;
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;

		return {
			organizationId,
			tenantId,
			employeeId: result.employee.id,
			categoryName: result.categoryName,
			value: result.value,
			currency: result.currency,
			startDay: result.startDay || 1,
			startMonth: result.startMonth || startDate.getMonth(),
			startYear: result.startYear || startDate.getFullYear(),
			startDate: result.startDate || new Date(startDate.getFullYear(), startDate.getMonth(), 1)
		};
	}

	private async _loadEmployeeRecurringExpense() {
		if (!this.organization) {
			return;
		}

		const { startDate, endDate } = this.selectedDateRange;
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;

		this.loading = true;

		this.fetchedHistories = {};
		if (this.selectedEmployeeId) {
			this.recurringExpenses = (
				await this.employeeRecurringExpenseService.getAllByRange(['employee', 'employee.user'], {
					employeeId: this.selectedEmployeeId,
					startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm'),
					endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm'),
					organizationId,
					tenantId
				})
			).items;
			this.loading = false;
		} else {
			this.recurringExpenses = (
				await this.employeeRecurringExpenseService.getAll(
					['employee', 'employee.user'],
					{
						organizationId,
						tenantId
					},
					{}
				)
			).items;
			this.loading = false;
		}
	}

	public async fetchHistory() {
		if (!this.organization) {
			return;
		}

		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;

		this.showHistory = !this.showHistory;
		this.fetchedHistories[this.selectedRecurringExpense.index] = (
			await this.employeeRecurringExpenseService.getAll(
				[],
				{
					parentRecurringExpenseId: this.selectedRecurringExpense.data.parentRecurringExpenseId,
					organizationId,
					tenantId
				},
				{ startDate: 'ASC' }
			)
		).items;
	}

	selectRecurringExpense(recurringExpense: IEmployeeRecurringExpense, i: number) {
		this.showHistory = false;
		this.selectedRecurringExpense =
			this.selectedRecurringExpense.data && recurringExpense.id === this.selectedRecurringExpense.data.id
				? {
						isSelected: !this.selectedRecurringExpense.isSelected,
						data: null,
						index: null
				  }
				: { isSelected: true, data: recurringExpense, index: i };
	}

	ngOnDestroy() {}
}
