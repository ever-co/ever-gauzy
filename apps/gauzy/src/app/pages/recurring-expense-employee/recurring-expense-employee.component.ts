import { Component, OnInit, OnDestroy } from '@angular/core';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import {
	IOrganization,
	RecurringExpenseDefaultCategoriesEnum,
	RecurringExpenseDeletionEnum,
	IEmployeeRecurringExpense,
	IEmployee
} from '@gauzy/models';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { first, debounceTime, filter, withLatestFrom } from 'rxjs/operators';
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
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-recurring-expenses-employee',
	templateUrl: './recurring-expense-employee.component.html',
	styleUrls: ['./recurring-expense-employee.component.scss']
})
export class RecurringExpensesEmployeeComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	selectedEmployee: IEmployee;
	selectedDate: Date;
	employeeList: IEmployee[] = [];
	selectedEmployeeFromHeader: SelectedEmployee;
	selectedEmployeeRecurringExpense: IEmployeeRecurringExpense[] = [];
	selectedRowIndexToShow: number;
	employeeName = this.getTranslation('EMPLOYEES_PAGE.EMPLOYEE_NAME');
	fetchedHistories: Object = {};
	selectedOrganization: IOrganization;
	selectedEmployeeId: string;

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
			.pipe(untilDestroyed(this))
			.subscribe((date) => {
				this.selectedDate = date;
				if (this.selectedOrganization) {
					this._loadEmployeeRecurringExpense();
				}
			});
		const storeEmployee$ = this.store.selectedEmployee$;
		const storeOrganization$ = this.store.selectedOrganization$;
		storeEmployee$
			.pipe(
				filter((employee) => !!employee),
				debounceTime(200),
				withLatestFrom(storeOrganization$),
				untilDestroyed(this)
			)
			.subscribe(([employee]) => {
				if (employee && this.selectedOrganization) {
					this.selectedEmployeeId = employee.id;
				}
			});
		storeOrganization$
			.pipe(
				filter((organization) => !!organization),
				debounceTime(200),
				withLatestFrom(storeEmployee$),
				untilDestroyed(this)
			)
			.subscribe(([organization, employee]) => {
				this.selectedEmployeeId = employee ? employee.id : null;
				if (organization) {
					this.selectedOrganization = organization;
					this._loadEmployeeRecurringExpense();
				}
			});
		this.route.params
			.pipe(untilDestroyed(this))
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
						: this.getTranslation('EMPLOYEES_PAGE.EMPLOYEE_NAME');
				}
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
				await this.employeeRecurringExpenseService
					.create(employeeRecurringExpense)
					.then(() => {
						this.toastrService.primary(
							this.getTranslation(
								'EMPLOYEES_PAGE.RECURRING_EXPENSE_SET',
								{ name: this.employeeName }
							),
							this.getTranslation('TOASTR.TITLE.SUCCESS')
						);
						this._loadEmployeeRecurringExpense();
					})
					.catch((error) => {
						this.toastrService.danger(
							error.error.message || error.message,
							this.getTranslation('TOASTR.TITLE.ERROR')
						);
					});
			} catch (error) {
				this.toastrService.danger(
					error.error.message || error.message,
					this.getTranslation('TOASTR.TITLE.ERROR')
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
				this.employeeRecurringExpenseService
					.update(id, employeeRecurringExpense)
					.then(() => {
						this.selectedRowIndexToShow = null;
						this.toastrService.primary(
							this.getTranslation(
								'EMPLOYEES_PAGE.RECURRING_EXPENSE_EDITED',
								{ name: this.employeeName }
							),
							this.getTranslation('TOASTR.TITLE.SUCCESS')
						);
						this._loadEmployeeRecurringExpense();
					})
					.catch((error) => {
						this.toastrService.danger(
							error.error.message || error.message,
							this.getTranslation('TOASTR.TITLE.ERROR')
						);
					});
			} catch (error) {
				this.toastrService.danger(
					error.error.message || error.message,
					this.getTranslation('TOASTR.TITLE.ERROR')
				);
			}
		}
	}

	async deleteEmployeeRecurringExpense(index: number) {
		const selectedExpense = this.selectedEmployeeRecurringExpense[index];
		const result: RecurringExpenseDeletionEnum = await this.dialogService
			.open(RecurringExpenseDeleteConfirmationComponent, {
				context: {
					recordType: this.getTranslation(
						'EMPLOYEES_PAGE.RECURRING_EXPENSE'
					),
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
				this.employeeRecurringExpenseService
					.delete(id, {
						deletionType: result,
						month: this.selectedDate.getMonth(),
						year: this.selectedDate.getFullYear()
					})
					.then(() => {
						this.selectedRowIndexToShow = null;
						this.toastrService.primary(
							this.getTranslation(
								'EMPLOYEES_PAGE.RECURRING_EXPENSE_DELETED',
								{ name: this.employeeName }
							),
							this.getTranslation('TOASTR.TITLE.SUCCESS')
						);
						this._loadEmployeeRecurringExpense();
					})
					.catch((error) => {
						this.toastrService.danger(
							error.error.message || error.message,
							this.getTranslation('TOASTR.TITLE.ERROR')
						);
					});
			} catch (error) {
				this.toastrService.danger(
					error.error.message || error.message,
					this.getTranslation('TOASTR.TITLE.ERROR')
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

	private async _loadEmployeeRecurringExpense() {
		if (!this.selectedOrganization) return;
		const { id: organizationId, tenantId } = this.selectedOrganization;
		this.fetchedHistories = {};
		if (this.selectedEmployeeId) {
			this.selectedEmployeeRecurringExpense = (
				await this.employeeRecurringExpenseService.getAllByMonth(
					['employee', 'employee.user'],
					{
						employeeId: this.selectedEmployeeId,
						year: this.selectedDate.getFullYear(),
						month: this.selectedDate.getMonth(),
						organizationId,
						tenantId
					}
				)
			).items;
		} else {
			this.selectedEmployeeRecurringExpense = (
				await this.employeeRecurringExpenseService.getAll(
					['employee', 'employee.user'],
					{
						organizationId,
						tenantId
					}
				)
			).items;
		}
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
				{ startDate: 'ASC' }
			)
		).items;
	}

	ngOnDestroy() {
		clearTimeout();
	}
}
