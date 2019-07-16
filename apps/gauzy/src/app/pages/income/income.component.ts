import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from '../../@core/services/auth.service';
import { RolesEnum } from '@gauzy/models';
import { Subject } from 'rxjs';
import { takeUntil, first } from 'rxjs/operators';
import { Store } from '../../@core/services/store.service';
import { IncomeService } from '../../@core/services/income.service';
import { FormBuilder, Validators } from '@angular/forms';
import { LocalDataSource } from 'ng2-smart-table';
import { NbDialogService } from '@nebular/theme';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';

interface IncomeViewModel {
    id: string,
    valueDate: string,
    clientName: string,
    clientId: string,
    amount: number
}

interface SelectedRowModel {
    data: IncomeViewModel,
    isSelected: boolean,
    selected: IncomeViewModel[],
    source: LocalDataSource
}

@Component({
    templateUrl: './income.component.html',
    styleUrls: ['./income.component.scss']
})

export class IncomeComponent implements OnInit, OnDestroy {
    private _ngDestroy$ = new Subject<void>();

    readonly form = this.fb.group({
        valueDate: [new Date((new Date()).getFullYear(), (new Date()).getMonth() + 1, 0), Validators.required],
        amount: ['', Validators.required],
        employeeId: ['', Validators.required],
        client: ['', Validators.required]
    });

    fakeClients = [
        {
            clientName: 'CUEAudio',
            clientId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            clientName: 'Urwex',
            clientId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            clientName: 'Nabo',
            clientId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            clientName: 'Gauzy',
            clientId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            clientName: 'Everbie',
            clientId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            clientName: 'Random Client',
            clientId: (Math.floor(Math.random() * 101) + 1).toString()
        }
    ];

    hasRole: boolean;
    selectedEmployeeId: string;
    smartTableSource = new LocalDataSource();

    selectedIncome: SelectedRowModel;

    get valueDate() {
        return this.form.get('valueDate').value;
    }

    set valueDate(value) {
        this.form.get('valueDate').setValue(value);
    }

    get amount() {
        return this.form.get('amount').value;
    }

    set amount(value) {
        this.form.get('amount').setValue(value);
    }

    get clientName() {
        return this.form.get('client').value.clientName;
    }

    get clientId() {
        return this.form.get('client').value.clientId;
    }

    smartTableSettings = {
        actions: false,
        mode: 'external',
        editable: true,
        noDataMessage: 'No data for the currently selected employee.',
        columns: {
            valueDate: {
                title: 'Date',
                type: 'string'
            },
            clientName: {
                title: 'Client Name',
                type: 'string'
            },
            amount: {
                title: 'Value',
                type: 'number',
                width: '15%'
            }
        },
        pager: {
            display: true,
            perPage: 8
        }
    };

    constructor(private authService: AuthService,
        private store: Store,
        private incomeService: IncomeService,
        private dialogService: NbDialogService,
        private fb: FormBuilder) { }

    async ngOnInit() {
        this.hasRole = await this.authService
            .hasRole([RolesEnum.ADMIN, RolesEnum.DATA_ENTRY])
            .pipe(first())
            .toPromise()

        this.store.selectedEmployeeId$
            .pipe(takeUntil(this._ngDestroy$))
            .subscribe(id => {
                this.selectedEmployeeId = id;
                this._loadEmployeeIncomeData(id);
                this.form.get('employeeId').setValue(id);
            });
    }

    selectIncome(ev: SelectedRowModel) {
        this.selectedIncome = ev;
        this.selectedIncome.isSelected ? this._populateFormForEdit() : this._clearForm();
    }

    async addIncome() {
        try {
            await this.incomeService.create({
                valueDate: this.valueDate,
                amount: this.amount,
                clientName: this.clientName,
                clientId: this.clientId,
                employeeId: this.selectedEmployeeId
            });

            this.amount = '';
            this.form.get('client').setValue('');
            this.form.get('valueDate').setValue(new Date((new Date()).getFullYear(), (new Date()).getMonth() + 1, 0));

            this._loadEmployeeIncomeData();
        } catch (error) {
            console.log(error)
        }
    }

    async editIncome() {
        try {
            await this.incomeService.update(this.selectedIncome.data.id, {
                valueDate: this.valueDate,
                amount: this.amount,
                clientName: this.clientName,
                clientId: this.clientId
            });

            this._loadEmployeeIncomeData();
            this._clearForm();
        } catch (error) {
            console.log(error);
        }
    }

    async deleteIncome() {
        this.dialogService.open(DeleteConfirmationComponent, {
            context: { recordType: 'Income' }
        })
            .onClose
            .pipe(takeUntil(this._ngDestroy$))
            .subscribe(async result => {
                if (result) {
                    try {
                        await this.incomeService
                            .delete(this.selectedIncome.data.id);

                        this._loadEmployeeIncomeData();
                        this._clearForm();
                        this.selectedIncome = null;
                    } catch (error) {
                        console.log(error)
                    }
                }
            });
    }

    private async _loadEmployeeIncomeData(id = this.selectedEmployeeId) {
        const { items } = await this.incomeService.getAll(['employee'], { employee: { id } });

        const incomeVM: IncomeViewModel[] = items.map(i => {
            return {
                id: i.id,
                valueDate: new Date(i.valueDate).toLocaleDateString('uk'),
                clientName: i.clientName,
                clientId: i.clientId,
                amount: i.amount
            }
        })

        this.smartTableSource.load(incomeVM);
    }

    private _populateFormForEdit() {
        this.amount = this.selectedIncome.data.amount;

        this.form.get('client').setValue({
            clientName: this.selectedIncome.data.clientName,
            clientId: this.selectedIncome.data.clientId
        });

        const dateArr = this.selectedIncome.data.valueDate.split('.');

        this.valueDate = new Date(+dateArr[2], +dateArr[1] - 1, +dateArr[0]);
    }

    private _clearForm() {
        this.amount = '';
        this.form.get('client').setValue('');
        this.form.get('valueDate').setValue(new Date((new Date()).getFullYear(), (new Date()).getMonth() + 1, 0));
    }

    ngOnDestroy() {
        this._ngDestroy$.next();
        this._ngDestroy$.complete();
    }
}
