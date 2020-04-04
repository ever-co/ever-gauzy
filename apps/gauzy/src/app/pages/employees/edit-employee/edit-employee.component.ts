import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
	Employee,
	EmployeeRecurringExpense,
	Organization,
	PermissionsEnum,
	RecurringExpenseDefaultCategoriesEnum,
	RecurringExpenseDeletionEnum
} from '@gauzy/models';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { first, takeUntil } from 'rxjs/operators';
import { EmployeeRecurringExpenseService } from '../../../@core/services/employee-recurring-expense.service';
import { EmployeesService } from '../../../@core/services/employees.service';
import { Store } from '../../../@core/services/store.service';
import { monthNames } from '../../../@core/utils/date';
import { RecurringExpenseDeleteConfirmationComponent } from '../../../@shared/expenses/recurring-expense-delete-confirmation/recurring-expense-delete-confirmation.component';
import {
	COMPONENT_TYPE,
	RecurringExpenseMutationComponent
} from '../../../@shared/expenses/recurring-expense-mutation/recurring-expense-mutation.component';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { SelectedEmployee } from '../../../@theme/components/header/selectors/employee/employee.component';

@Component({
	selector: 'ngx-edit-employee',
	templateUrl: './edit-employee.component.html',
	styleUrls: [
		'../../organizations/edit-organization/edit-organization.component.scss',
		'../../dashboard/dashboard.component.scss'
	]
})
export class EditEmployeeComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	selectedEmployee: Employee;
	selectedDate: Date;
	selectedEmployeeFromHeader: SelectedEmployee;
	selectedEmployeeRecurringExpense: EmployeeRecurringExpense[];
	selectedRowIndexToShow: number;
	employeeName = 'Employee';
	hasEditPermission = false;
	hasEditExpensePermission = false;
	fetchedHistories: Object = {};
	selectedOrganization: Organization;

	constructor(
		private route: ActivatedRoute,
		private router: Router,
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
					this._loadEmployeeRecurringExpense();
				}
			});

		this.store.userRolePermissions$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.hasEditPermission = this.store.hasPermission(
					PermissionsEnum.ORG_EMPLOYEES_EDIT
				);
				this.hasEditExpensePermission = this.store.hasPermission(
					PermissionsEnum.ORG_EXPENSES_EDIT
				);
			});

		this.route.params
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (params) => {
				const id = params.id;

				const { items } = await this.employeeService
					.getAll(['user', 'organizationPosition', 'tags'], { id })
					.pipe(first())
					.toPromise();

				this.selectedEmployee = items[0];

				this.store.selectedEmployee = {
					id: items[0].id,
					firstName: items[0].user.firstName,
					lastName: items[0].user.lastName,
					imageUrl: items[0].user.imageUrl,
					tags: items[0].user.tags
				};

				const checkUsername = this.selectedEmployee.user.username;
				this.employeeName = checkUsername ? checkUsername : 'Employee';

				if (this.selectedDate) {
					this._loadEmployeeRecurringExpense();
				}

				this.store.selectedEmployee$
					.pipe(takeUntil(this._ngDestroy$))
					.subscribe((employee) => {
						this.selectedEmployeeFromHeader = employee;
						if (employee.id) {
							this.router.navigate([
								'/pages/employees/edit/' + employee.id
							]);
						}
					});

				this.store.selectedOrganization$
					.pipe(takeUntil(this._ngDestroy$))
					.subscribe((organization) => {
						this.selectedOrganization = organization;
					});
			});
	}

	editEmployee() {
		this.router.navigate([
			'/pages/employees/edit/' + this.selectedEmployee.id + '/profile'
		]);
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
					selectedDate: this.selectedDate
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
				this._loadEmployeeRecurringExpense();
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
					this._loadEmployeeRecurringExpense();
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
					this._loadEmployeeRecurringExpense();
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
	): EmployeeRecurringExpense {
		return {
			employeeId: this.selectedEmployee.id,
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

	private async _loadEmployeeRecurringExpense() {
		this.fetchedHistories = {};
		this.selectedEmployeeRecurringExpense = (
			await this.employeeRecurringExpenseService.getAllByMonth([], {
				employeeId: this.selectedEmployee.id,
				year: this.selectedDate.getFullYear(),
				month: this.selectedDate.getMonth()
			})
		).items;
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
