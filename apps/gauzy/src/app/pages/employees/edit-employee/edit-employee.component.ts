import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
	Employee,
	EmployeeRecurringExpense,
	RecurringExpenseDeletionEnum
} from '@gauzy/models';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { Subject } from 'rxjs';
import { first, takeUntil } from 'rxjs/operators';
import { EmployeeRecurringExpenseService } from '../../../@core/services/employee-recurring-expense.service';
import { EmployeesService } from '../../../@core/services/employees.service';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { Store } from '../../../@core/services/store.service';
import { monthNames } from '../../../@core/utils/date';
import { EmployeeRecurringExpenseMutationComponent } from '../../../@shared/employee/employee-recurring-expense-mutation/employee-recurring-expense-mutation.component';
import { RecurringExpenseDeleteConfirmationComponent } from '../../../@shared/expenses/recurring-expense-delete-confirmation/recurring-expense-delete-confirmation.component';
import { SelectedEmployee } from '../../../@theme/components/header/selectors/employee/employee.component';

@Component({
	selector: 'ngx-edit-employee',
	templateUrl: './edit-employee.component.html',
	styleUrls: [
		'./edit-employee.component.scss',
		'../../dashboard/dashboard.component.scss'
	]
})
export class EditEmployeeComponent implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	selectedEmployee: Employee;
	selectedDate: Date;
	selectedEmployeeFromHeader: SelectedEmployee;
	selectedEmployeeRecurringExpense: EmployeeRecurringExpense[];
	selectedRowIndexToShow: number;
	employeeName = 'Employee';

	constructor(
		private route: ActivatedRoute,
		private router: Router,
		private employeeService: EmployeesService,
		private organizationsService: OrganizationsService,
		private store: Store,
		private dialogService: NbDialogService,
		private employeeRecurringExpenseService: EmployeeRecurringExpenseService,
		private toastrService: NbToastrService
	) {}

	async ngOnInit() {
		this.store.selectedDate$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((date) => {
				this.selectedDate = date;

				if (this.selectedEmployeeFromHeader) {
					this._loadEmployeeRecurringExpense();
				}
			});

		this.route.params
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (params) => {
				const id = params.id;

				const { items } = await this.employeeService
					.getAll(['user'], { id })
					.pipe(first())
					.toPromise();

				this.selectedEmployee = items[0];

				this.store.selectedEmployee = {
					id: items[0].id,
					firstName: items[0].user.firstName,
					lastName: items[0].user.lastName,
					imageUrl: items[0].user.imageUrl
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
			});
	}

	editEmployee() {
		this.router.navigate([
			'/pages/employees/edit/' + this.selectedEmployee.id + '/profile'
		]);
	}

	async addEmployeeRecurringExpense() {
		// TODO get currency from the page dropdown
		const organization = this.store.selectedOrganization;

		const result = await this.dialogService
			.open(EmployeeRecurringExpenseMutationComponent)
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			try {
				await this.employeeRecurringExpenseService.create({
					employeeId: this.selectedEmployee.id,
					// TODO
					categoryName: result.categoryName,
					value: result.value,
					startDay: 1,
					startYear: this.selectedDate.getFullYear(),
					startMonth: this.selectedDate.getMonth() + 1,
					startDate: new Date(
						this.selectedDate.getFullYear(),
						this.selectedDate.getMonth(),
						1
					),
					currency: result.currency
				});

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

	getMonthString(month: number) {
		const months = monthNames;

		return months[month - 1];
	}

	showMenu(index: number) {
		this.selectedRowIndexToShow = index;
	}

	async editEmployeeRecurringExpense(index: number) {
		const result = await this.dialogService
			.open(EmployeeRecurringExpenseMutationComponent, {
				// TODO
				context: {
					employeeRecurringExpense: this
						.selectedEmployeeRecurringExpense[index]
				}
			})
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			try {
				const id = this.selectedEmployeeRecurringExpense[index].id;
				await this.employeeRecurringExpenseService.update(id, {
					...result,
					startDay: 1,
					startMonth: this.selectedDate.getMonth() + 1,
					startYear: this.selectedDate.getFullYear()
				});
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
						this.selectedDate.getMonth() + 1
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
					month: this.selectedDate.getMonth() + 1,
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

	private async _loadEmployeeRecurringExpense() {
		this.selectedEmployeeRecurringExpense = (await this.employeeRecurringExpenseService.getAll(
			[],
			{
				employeeId: this.selectedEmployee.id,
				year: this.selectedDate.getFullYear(),
				month: this.selectedDate.getMonth() + 1
			}
		)).items;
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
		clearTimeout();
	}
}
