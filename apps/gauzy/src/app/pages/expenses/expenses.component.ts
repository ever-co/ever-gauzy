import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from '../../@core/services/auth.service';
import { RolesEnum } from '@gauzy/models';
import { first, takeUntil } from 'rxjs/operators';
import { NbDialogService } from '@nebular/theme';
import { ExpensesMutationComponent } from '../../@shared/expenses/expenses-mutation/expenses-mutation.component';
import { Store } from '../../@core/services/store.service';
import { Subject } from 'rxjs';
import { ExpensesService } from '../../@core/services/expenses.service';
import { LocalDataSource } from 'ng2-smart-table';

export interface ExpenseViewModel {
    id: string,
    valueDate: string,
    vendorId: string,
    vendorName: string,
    categoryId: string,
    categoryName: string,
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
                type: 'string'
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

    private _ngDestroy$ = new Subject<void>();

    selectedEmployeeId: string;
    selectedOrganizationId: string;

    hasRole: boolean;

    smartTableSource = new LocalDataSource();

    selectedExpense: SelectedRowModel;

    get smartTableSettings() {
        return ExpensesComponent.smartTableSettings;
    }

    constructor(private authService: AuthService,
        private dialogService: NbDialogService,
        private store: Store,
        private expenseService: ExpensesService) { }

    async ngOnInit() {
        this.hasRole = await this.authService
            .hasRole([RolesEnum.ADMIN, RolesEnum.DATA_ENTRY])
            .pipe(first())
            .toPromise();

        this.store.selectedOrganizationId$
            .pipe(takeUntil(this._ngDestroy$))
            .subscribe(id => {
                this.selectedOrganizationId = id;

                if (this.selectedEmployeeId) {
                    this._loadTableData();
                }
            });

        this.store.selectedEmployee$
            .pipe(takeUntil(this._ngDestroy$))
            .subscribe(employee => {
                this.selectedEmployeeId = employee.id;

                if (this.selectedOrganizationId) {
                    this._loadTableData();
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
                                orgId: this.selectedOrganizationId,
                                amount: formData.amount,
                                categoryId: formData.category.categoryId,
                                categoryName: formData.category.categoryName,
                                vendorId: formData.vendor.vendorId,
                                vendorName: formData.vendor.vendorName,
                                valueDate: formData.valueDate,
                                notes: formData.notes
                            });

                        this._loadTableData();
                    } catch (error) {
                        console.log(error)
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
                            notes: formData.notes
                        });

                        this._loadTableData();
                    } catch (error) {
                        console.log(error)
                    }
                }
            });
    }

    async deleteExpense() {
        this.dialogService.open(ExpensesMutationComponent) // TODO: Use shared delete confirm component!
            .onClose
            .pipe(takeUntil(this._ngDestroy$))
            .subscribe(async result => {
                if (result) {
                    try {
                        await this.expenseService
                            .delete(this.selectedExpense.data.id);

                        this._loadTableData();
                        this.selectedExpense = null;
                    } catch (error) {
                        console.log(error)
                    }
                }
            });
    }

    selectExpense(ev: SelectedRowModel) {
        this.selectedExpense = ev;
    }

    private async _loadTableData() {
        try {
            const { items } = await this.expenseService
                .getAll(['employee', 'organization'],
                    {
                        employee: { id: this.selectedEmployeeId },
                        organization: { id: this.selectedOrganizationId }
                    });

            const expenseVM: ExpenseViewModel[] = items.map(i => {
                return {
                    id: i.id,
                    valueDate: new Date(i.valueDate).toLocaleDateString(),
                    vendorId: i.vendorId,
                    vendorName: i.vendorName,
                    categoryId: i.categoryId,
                    categoryName: i.categoryName,
                    amount: i.amount,
                    notes: i.notes
                }
            });

            this.smartTableSource.load(expenseVM);
        } catch (error) {
            console.log(error)
        }
    }

    ngOnDestroy() {
        this._ngDestroy$.next();
        this._ngDestroy$.complete();
    }
}