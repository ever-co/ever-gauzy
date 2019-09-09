import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, first } from 'rxjs/operators';
import { EmployeesService } from '../../../@core/services/employees.service';
import { Store } from '../../../@core/services/store.service';
import { Employee, EmployeeRecurringExpense } from '@gauzy/models';
import { SelectedEmployee } from '../../../@theme/components/header/selectors/employee/employee.component';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { EmployeeRecurringExpenseMutationComponent } from '../../../@shared/employee/employee-recurring-expense-mutation/employee-recurring-expense-mutation.component';
import { DeleteConfirmationComponent } from '../../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { monthNames } from '../../../@core/utils/date';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { EmployeeRecurringExpenseService } from '../../../@core/services/employee-recurring-expense.service';

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

    constructor(private route: ActivatedRoute,
        private router: Router,
        private employeeService: EmployeesService,
        private organizationsService: OrganizationsService,
        private store: Store,
        private dialogService: NbDialogService,
        private employeeRecurringExpenseService: EmployeeRecurringExpenseService,
        private toastrService: NbToastrService) { }

    async ngOnInit() {
        this.store.selectedDate$
            .pipe(takeUntil(this._ngDestroy$))
            .subscribe(date => {
                this.selectedDate = date;

                if (this.selectedEmployeeFromHeader) {
                    this._loadEmployeeRecurringExpense();
                }
            });

        this.route.params
            .pipe(takeUntil(this._ngDestroy$))
            .subscribe(async params => {
                const id = params.id;

                const { items } = await this.employeeService.getAll(['user'], { id }).pipe(first()).toPromise();

                this.selectedEmployee = items[0];

                this.store.selectedEmployee = {
                    id: items[0].id,
                    firstName: items[0].user.firstName,
                    lastName: items[0].user.lastName,
                    imageUrl: items[0].user.imageUrl
                };

                if (this.selectedDate) {
                    this._loadEmployeeRecurringExpense();
                }

                this.store.selectedEmployee$
                    .pipe(takeUntil(this._ngDestroy$))
                    .subscribe(employee => {
                        this.selectedEmployeeFromHeader = employee;
                        if (employee.id) {
                            this.router.navigate(['/pages/employees/edit/' + employee.id]);
                        }
                    });
            });
    }

    editEmployee() {
        this.router.navigate(['/pages/employees/edit/' + this.selectedEmployee.id + '/profile']);
    }

    async addEmployeeRecurringExpense() {
        // TODO get currency from the page dropdown
        let currency;
        const organization = this.store.selectedOrganization;

        if (organization) {
            currency = organization.currency;
        }

        const result = await this.dialogService
            .open(EmployeeRecurringExpenseMutationComponent)
            .onClose
            .pipe(first())
            .toPromise();

        if (result) {
            try {
                await this.employeeRecurringExpenseService.create({
                    employeeId: this.selectedEmployee.id,
                    // TODO
                    categoryName: result.categoryName,
                    value: result.value,
                    year: this.selectedDate.getFullYear(),
                    month: this.selectedDate.getMonth() + 1,
                    currency: result.currency
                });

                this.toastrService.info('Employee recurring expense set.', 'Success');
                this._loadEmployeeRecurringExpense();
            } catch (error) {
                this.toastrService.danger(error.error.message || error.message, 'Error');
            }
        }
    }

    getMonthString(month: number) {
        const months = monthNames

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
                    employeeRecurringExpense: this.selectedEmployeeRecurringExpense[index]
                }
            })
            .onClose
            .pipe(first())
            .toPromise();

        if (result) {
            try {
                const id = this.selectedEmployeeRecurringExpense[index].id;
                await this.employeeRecurringExpenseService.update(id, result);
                this.selectedRowIndexToShow = null;
                this._loadEmployeeRecurringExpense();

                this.toastrService.info('Employee recurring expense edited.', 'Success');
                setTimeout(() => {
                    this._loadEmployeeRecurringExpense();
                }, 300);
            } catch (error) {
                this.toastrService.danger(error.error.message || error.message, 'Error');
            }
        }
    }

    async deleteEmployeeRecurringExpense(index: number) {
        const result = await this.dialogService.open(DeleteConfirmationComponent, {
            context: { recordType: 'Employee recurring expense' }
        })
            .onClose
            .pipe(first())
            .toPromise();

        if (result) {
            try {
                const id = this.selectedEmployeeRecurringExpense[index].id;
                await this.employeeRecurringExpenseService.delete(id);
                this.selectedRowIndexToShow = null;

                this.toastrService.info('Employee recurring expense deleted.', 'Success');
                setTimeout(() => {
                    this._loadEmployeeRecurringExpense();
                }, 100);
            } catch (error) {
                this.toastrService.danger(error.error.message || error.message, 'Error');
            }
        }
    }

    private async _loadEmployeeRecurringExpense() {
        this.selectedEmployeeRecurringExpense = (await this.employeeRecurringExpenseService.getAll([], {
            employeeId: this.selectedEmployee.id,
            year: this.selectedDate.getFullYear(),
            month: this.selectedDate.getMonth() + 1
        })).items;
    }

    ngOnDestroy() {
        this._ngDestroy$.next();
        this._ngDestroy$.complete();
    }
}
