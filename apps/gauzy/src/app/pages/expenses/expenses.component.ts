import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from '../../@core/services/auth.service';
import { RolesEnum, Expense } from '@gauzy/models';
import { first, takeUntil } from 'rxjs/operators';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { ExpensesMutationComponent } from '../../@shared/expenses/expenses-mutation/expenses-mutation.component';
import { Store } from '../../@core/services/store.service';
import { Subject } from 'rxjs';
import { ExpensesService } from '../../@core/services/expenses.service';
import { LocalDataSource } from 'ng2-smart-table';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { DateViewComponent } from '../../@shared/table-components/date-view/date-view.component';
import { ActivatedRoute } from '@angular/router';

export interface ExpenseViewModel {
    id: string,
    valueDate: Date,
    vendorId: string,
    vendorName: string,
    categoryId: string,
    categoryName: string,
    currency: string,
    amount: number,
    notes: string
}

interface SelectedRowModel {
    data: ExpenseViewModel,
    isSelected: boolean,
    selected: ExpenseViewModel[],
    source: LocalDataSource
}

@Component({
    templateUrl: './expenses.component.html',
    styleUrls: ['./expenses.component.scss'],
})

export class ExpensesComponent implements OnInit, OnDestroy {
    static smartTableSettings = {
        actions: false,
        editable: true,
        noDataMessage: 'No data for the currently selected Employee & Organization.',
        columns: {
            valueDate: {
                title: 'Date',
                type: 'custom',
                width: '20%',
                renderComponent: DateViewComponent,
                filter: false
            },
            vendorName: {
                title: 'Vendor',
                type: 'string'
            },
            categoryName: {
                title: 'Category',
                type: 'string'
            },
            amount: {
                title: 'Value',
                type: 'number',
                filter: false
            },
            notes: {
                title: 'Notes',
                type: 'string'
            }
        },
        pager: {
            display: true,
            perPage: 8
        }
    };

    selectedEmployeeId: string;
    selectedDate: Date;

    hasRole: boolean;

    smartTableSource = new LocalDataSource();

    selectedExpense: SelectedRowModel;
    showTable: boolean;

    private _ngDestroy$ = new Subject<void>();
    private _selectedOrganizationId: string;

    get smartTableSettings() {
        return ExpensesComponent.smartTableSettings;
    }

    constructor(private authService: AuthService,
        private dialogService: NbDialogService,
        private store: Store,
        private expenseService: ExpensesService,
        private toastrService: NbToastrService,
        private route: ActivatedRoute) { }

    async ngOnInit() {
        this.hasRole = await this.authService
            .hasRole([RolesEnum.ADMIN, RolesEnum.DATA_ENTRY])
            .pipe(first())
            .toPromise();

        this.store.selectedDate$
            .pipe(takeUntil(this._ngDestroy$))
            .subscribe(date => {
                this.selectedDate = date;

                if (this.selectedEmployeeId) {
                    this._loadTableData();
                } else {
                    if (this._selectedOrganizationId) {
                        this._loadTableData(this._selectedOrganizationId);
                    }
                }
            });

        this.store.selectedEmployee$
            .pipe(takeUntil(this._ngDestroy$))
            .subscribe(employee => {
                if (employee && employee.id) {
                    this.selectedEmployeeId = employee.id;
                    this._loadTableData();
                } else {
                    if (this._selectedOrganizationId) {
                        this._loadTableData(this._selectedOrganizationId);
                    }
                }
            });

        this.store.selectedOrganization$
            .pipe(takeUntil(this._ngDestroy$))
            .subscribe(org => {
                if (org) {
                    this._selectedOrganizationId = org.id
                    this.store.selectedEmployee = null;
                }
            })

        this.route.queryParamMap
            .pipe(takeUntil(this._ngDestroy$))
            .subscribe(params => {
                if (params.get('openAddDialog')) {
                    this.openAddExpenseDialog();
                }
            });
    }

    openAddExpenseDialog() {
        this.dialogService.open(ExpensesMutationComponent)
            .onClose
            .pipe(takeUntil(this._ngDestroy$))
            .subscribe(async formData => {
                if (formData) {
                    try {
                        await this.expenseService
                            .create({
                                employeeId: this.selectedEmployeeId,
                                amount: formData.amount,
                                categoryId: formData.category.categoryId,
                                categoryName: formData.category.categoryName,
                                vendorId: formData.vendor.vendorId,
                                vendorName: formData.vendor.vendorName,
                                valueDate: formData.valueDate,
                                notes: formData.notes,
                                currency: formData.currency
                            });

                        this.toastrService.info('Expense added.', 'Success');
                        this._loadTableData();
                    } catch (error) {
                        this.toastrService.danger(error.error.message || error.message, 'Error');
                    }
                }
            });
    }

    openEditExpenseDialog() {
        this.dialogService.open(ExpensesMutationComponent, {
            context: {
                expense: this.selectedExpense.data
            }
        })
            .onClose
            .pipe(takeUntil(this._ngDestroy$))
            .subscribe(async formData => {
                if (formData) {
                    try {
                        await this.expenseService.update(formData.id, {
                            amount: formData.amount,
                            categoryId: formData.category.categoryId,
                            categoryName: formData.category.categoryName,
                            vendorId: formData.vendor.vendorId,
                            vendorName: formData.vendor.vendorName,
                            valueDate: formData.valueDate,
                            notes: formData.notes,
                            currency: formData.currency
                        });

                        this.toastrService.info('Expense edited.', 'Success');
                        this._loadTableData();
                    } catch (error) {
                        this.toastrService.danger(error.error.message || error.message, 'Error');
                    }
                }
            });
    }

    async deleteExpense() {
        this.dialogService.open(DeleteConfirmationComponent, {
            context: { recordType: 'Expense' }
        })
            .onClose
            .pipe(takeUntil(this._ngDestroy$))
            .subscribe(async result => {
                if (result) {
                    try {
                        await this.expenseService
                            .delete(this.selectedExpense.data.id);

                        this.toastrService.info('Expense deleted.', 'Success');
                        this._loadTableData();
                        this.selectedExpense = null;
                    } catch (error) {
                        this.toastrService.danger(error.error.message || error.message, 'Error');
                    }
                }
            });
    }

    selectExpense(ev: SelectedRowModel) {
        this.selectedExpense = ev;
    }

    private async _loadTableData(orgId?: string) {
        let findObj;
        this.showTable = false;

        if (orgId) {
            findObj = {
                organization: {
                    id: orgId
                }
            }

            ExpensesComponent.smartTableSettings.columns['employee'] = {
                title: 'Employee',
                type: 'string',
                valuePrepareFunction: (_, expense: Expense) => {
                    const user = expense.employee.user;

                    if (user) {
                        return `${user.firstName} ${user.lastName}`
                    }
                }
            }
        } else {
            findObj = {
                employee: {
                    id: this.selectedEmployeeId
                }
            }

            delete ExpensesComponent.smartTableSettings.columns['employee']
        }

        try {
            const { items } = await this.expenseService
                .getAll(['employee', 'employee.user'], findObj, this.selectedDate);

            const expenseVM: ExpenseViewModel[] = items.map(i => {
                return {
                    id: i.id,
                    valueDate: i.valueDate,
                    vendorId: i.vendorId,
                    vendorName: i.vendorName,
                    categoryId: i.categoryId,
                    categoryName: i.categoryName,
                    amount: i.amount,
                    notes: i.notes,
                    currency: i.currency,
                    employee: i.employee
                }
            });

            this.smartTableSource.load(expenseVM);
            this.showTable = true;
        } catch (error) {
            this.toastrService.danger(error.error.message || error.message, 'Error');
        }
    }

    ngOnDestroy() {
        this._ngDestroy$.next();
        this._ngDestroy$.complete();
    }
}