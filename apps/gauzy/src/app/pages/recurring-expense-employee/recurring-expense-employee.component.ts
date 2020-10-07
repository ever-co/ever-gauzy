import { Component, OnInit, OnDestroy } from '@angular/core';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import {
	IOrganization,
	PermissionsEnum,
	RecurringExpenseDefaultCategoriesEnum,
	RecurringExpenseDeletionEnum,
	IEmployeeRecurringExpense,
	IEmployee
} from '@gauzy/models';
import { Subject } from 'rxjs';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import {
	takeUntil,
	first,
	distinctUntilChanged,
	debounceTime
} from 'rxjs/operators';
import { monthNames } from '../../@core/utils/date';
import { RecurringExpenseDeleteConfirmationComponent } from '../../@shared/expenses/recurring-expense-delete-confirmation/recurring-expense-delete-confirmation.component';
import {
	RecurringExpenseMutationComponent,
	COMPONENT_TYPE
} from '../../@shared/expenses/recurring-expense-mutation/recurring-expense-mutation.component';
import { Store } from '../../@core/services/store.service';
import { SelectedEmployee } from '../../@theme/components/header/selectors/employee/employee.component';
import { ActivatedRoute } from '@angular/router';
import { EmployeesService } from '../../@core/services';
import { EmployeeRecurringExpenseService } from '../../@core/services/employee-recurring-expense.service';

@Component({
	selector: 'ga-recurring-expenses-employee',
	templateUrl: './recurring-expense-employee.component.html',
	styleUrls: ['./recurring-expense-employee.component.scss']
})
export class RecurringExpensesEmployeeComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	selectedEmployee: IEmployee;
	selectedDate: Date;
	employeeList: IEmployee[] = [];
	selectedEmployeeFromHeader: SelectedEmployee;
	selectedEmployeeRecurringExpense: IEmployeeRecurringExpense[] = [];
	selectedRowIndexToShow: number;
	employeeName = 'Employee';
	hasEditExpensePermission = false;
	fetchedHistories: Object = {};
	selectedOrganization: IOrganization;

	constructor(
		private route: ActivatedRoute,
		private employeeService: EmployeesService,
		private store: Store,
		private dialogService: NbDialogService,
		private employeeRecurringExpenseService: EmployeeRecurringExpenseService,
		private toastrService: NbToastrService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	async ngOnInit() {
		this.store.selectedDate$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((date) => {
				this.selectedDate = date;
				if (this.selectedEmployeeFromHeader) {
					this._loadEmployeeRecurringExpense(
						this.selectedEmployeeFromHeader.id
					);
				}
			});

		this.store.userRolePermissions$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.hasEditExpensePermission = this.store.hasPermission(
					PermissionsEnum.ORG_EXPENSES_EDIT
				);
			});

		this.route.params
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (params) => {
				if (params.hasOwnProperty('id')) {
					const id = params.id;
					const { items } = await this.employeeService
						.getAll(
							['user', 'organizationPosition', 'tags', 'skills'],
							{ id }
						)
						.pipe(first())
						.toPromise();

					this.selectedEmployee = items[0];

					this.store.selectedEmployee = {
						id: items[0].id,
						firstName: items[0].user.firstName,
						lastName: items[0].user.lastName,
						imageUrl: items[0].user.imageUrl,
						tags: items[0].user.tags,
						skills: items[0].skills
					};

					const checkUsername = this.selectedEmployee.user.username;
					this.employeeName = checkUsername
						? checkUsername
						: 'Employee';
				}

				this.store.selectedEmployee$
					.pipe(
						distinctUntilChanged(),
						debounceTime(300),
						takeUntil(this._ngDestroy$)
					)
					.subscribe((employee) => {
						if (this.selectedOrganization) {
							if (employee && typeof employee.id === 'string') {
								this.selectedEmployeeFromHeader = employee;
								this._loadEmployeeRecurringExpense(employee.id);
							} else {
								this._loadEmployeeRecurringExpense(null);
							}
						}
					});

				this.store.selectedOrganization$
					.pipe(takeUntil(this._ngDestroy$))
					.subscribe((organization) => {
						if (organization) {
							this.selectedOrganization = organization;
							this.selectedEmployeeFromHeader = null;
							this.loadEmployees();

							this.store.selectedEmployee = this.selectedEmployeeFromHeader;
						}
					});
			});
	}

	getMonthString(month: number) {
		return monthNames[month];
	}

	getCategoryName(categoryName: string) {
		return categoryName in RecurringExpenseDefaultCategoriesEnum
			? this.getTranslation(
					`EXPENSES_PAGE.DEFAULT_CATEGORY.${categoryName}`
			  )
			: categoryName;
	}

	showMenu(index: number) {
		this.selectedRowIndexToShow = index;
	}

	async addEmployeeRecurringExpense() {
		// TODO get currency from the page dropdown
		const result = await this.dialogService
			.open(RecurringExpenseMutationComponent, {
				context: {
					componentType: COMPONENT_TYPE.EMPLOYEE,
					selectedDate: this.selectedDate,
					isAdd: true
				}
			})
			.onClose.pipe(first())
			.toPromise();
		if (result) {
			try {
				const employeeRecurringExpense = this._recurringExpenseMutationResultTransform(
					result
				);

				await this.employeeRecurringExpenseService.create(
					employeeRecurringExpense
				);
				this.toastrService.primary(
					this.employeeName + ' recurring expense set.',
					'Success'
				);

				this._loadEmployeeRecurringExpense(
					!this.selectedEmployeeFromHeader
						? null
						: this.selectedEmployeeFromHeader.id
				);
			} catch (error) {
				this.toastrService.danger(
					error.error.message || error.message,
					'Error'
				);
			}
		}
	}

	async editEmployeeRecurringExpense(index: number) {
		const result = await this.dialogService
			.open(RecurringExpenseMutationComponent, {
				// TODO
				context: {
					recurringExpense: this.selectedEmployeeRecurringExpense[
						index
					],
					componentType: COMPONENT_TYPE.EMPLOYEE
				}
			})
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			try {
				const id = this.selectedEmployeeRecurringExpense[index].id;
				const employeeRecurringExpense = this._recurringExpenseMutationResultTransform(
					result
				);
				await this.employeeRecurringExpenseService.update(
					id,
					employeeRecurringExpense
				);
				this.selectedRowIndexToShow = null;
				this._loadEmployeeRecurringExpense();

				this.toastrService.primary(
					this.employeeName + ' recurring expense edited.',
					'Success'
				);
				setTimeout(() => {
					this._loadEmployeeRecurringExpense(
						this.selectedEmployeeFromHeader === null
							? null
							: employeeRecurringExpense.employeeId
					);
				}, 300);
			} catch (error) {
				this.toastrService.danger(
					error.error.message || error.message,
					'Error'
				);
			}
		}
	}

	async deleteEmployeeRecurringExpense(index: number) {
		const selectedExpense = this.selectedEmployeeRecurringExpense[index];
		const result: RecurringExpenseDeletionEnum = await this.dialogService
			.open(RecurringExpenseDeleteConfirmationComponent, {
				context: {
					recordType: 'Employee recurring expense',
					start: `${this.getMonthString(
						selectedExpense.startMonth
					)}, ${selectedExpense.startYear}`,
					current: `${this.getMonthString(
						this.selectedDate.getMonth()
					)}, ${this.selectedDate.getFullYear()}`,
					end: selectedExpense.endMonth
						? `${this.getMonthString(selectedExpense.endMonth)}, ${
								selectedExpense.endYear
						  }`
						: 'end'
				}
			})
			.onClose.pipe(first())
			.toPromise();
		if (result) {
			try {
				const id = selectedExpense.id;
				await this.employeeRecurringExpenseService.delete(id, {
					deletionType: result,
					month: this.selectedDate.getMonth(),
					year: this.selectedDate.getFullYear()
				});
				this.selectedRowIndexToShow = null;

				this.toastrService.primary(
					this.employeeName + ' recurring expense deleted.',
					'Success'
				);
				setTimeout(() => {
					this._loadEmployeeRecurringExpense(
						this.selectedEmployeeFromHeader === null
							? null
							: selectedExpense.employeeId
					);
				}, 100);
			} catch (error) {
				this.toastrService.danger(
					error.error.message || error.message,
					'Error'
				);
			}
		}
	}

	private _recurringExpenseMutationResultTransform(
		result
	): IEmployeeRecurringExpense {
		const { id: organizationId, tenantId } = this.selectedOrganization;
		return {
			organizationId,
			tenantId,
			employeeId: result.employee.id,
			categoryName: result.categoryName,
			value: result.value,
			currency: result.currency,
			startDay: result.startDay || 1,
			startMonth: result.startMonth || this.selectedDate.getMonth(),
			startYear: result.startYear || this.selectedDate.getFullYear(),
			startDate:
				result.startDate ||
				new Date(
					this.selectedDate.getFullYear(),
					this.selectedDate.getMonth(),
					1
				)
		};
	}

	private async _loadEmployeeRecurringExpense(employeeId?: string) {
		const { id: organizationId, tenantId } = this.selectedOrganization;
		this.fetchedHistories = {};
		if (employeeId) {
			this.selectedEmployeeRecurringExpense = (
				await this.employeeRecurringExpenseService.getAllByMonth([], {
					employeeId,
					year: this.selectedDate.getFullYear(),
					month: this.selectedDate.getMonth(),
					organizationId,
					tenantId
				})
			).items;
		} else {
			this.selectedEmployeeRecurringExpense = (
				await this.employeeRecurringExpenseService.getAll([], {
					organizationId,
					tenantId
				})
			).items;
		}
	}
	async loadEmployees() {
		this.employeeList = [];
		const { id: organizationId, tenantId } = this.selectedOrganization;
		const { items } = await this.employeeService
			.getAll(['user'], { organizationId, tenantId })
			.pipe(first())
			.toPromise();
		this.employeeList = items;
	}
	public async fetchHistory(i: number) {
		this.fetchedHistories[i] = (
			await this.employeeRecurringExpenseService.getAll(
				[],
				{
					parentRecurringExpenseId: this
						.selectedEmployeeRecurringExpense[i]
						.parentRecurringExpenseId
				},
				{
					startDate: 'ASC'
				}
			)
		).items;
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
		clearTimeout();
	}
}
