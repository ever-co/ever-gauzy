import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from '../../@core/services/auth.service';
import { RolesEnum } from '@gauzy/models';
import { Subject } from 'rxjs';
import { takeUntil, first } from 'rxjs/operators';
import { Store } from '../../@core/services/store.service';
import { IncomeService } from '../../@core/services/income.service';
import { FormBuilder, Validators } from '@angular/forms';
import { LocalDataSource } from 'ng2-smart-table';

interface IncomeViewModel {
    date: string,
    clientName: string,
    amount: number
}

@Component({
    templateUrl: './income.component.html',
    styleUrls: ['./income.component.scss']
})

export class IncomeComponent implements OnInit, OnDestroy {
    private _ngDestroy$ = new Subject<void>();
    readonly form = this.fb.group({
        date: [new Date((new Date()).getFullYear(), (new Date()).getMonth() + 1, 0), Validators.required],
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

    get date() {
        return this.form.get('date').value;
    }

    set date(value) {
        this.form.get('date').setValue(value);
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
        editable: true,
        noDataMessage: 'No data for the currently selected employee.',
        columns: {
            date: {
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

    async addIncome() {
        try {
            await this.incomeService.create({
                valueDate: this.date,
                amount: this.amount,
                clientName: this.clientName,
                clientId: this.clientId,
                employeeId: this.selectedEmployeeId
            }).pipe(first()).toPromise();

            this.amount = '';
            this.form.get('client').setValue('');

            this._loadEmployeeIncomeData();
        } catch (error) {
            console.log(error)
        }
    }

    private async _loadEmployeeIncomeData(id = this.selectedEmployeeId) {
        const { items } = await this.incomeService.getAll(['employee'], { employee: { id } }).pipe(first()).toPromise();

        const incomeVM: IncomeViewModel[] = items.map(i => {
            return {
                date: new Date(i.valueDate).toLocaleDateString(),
                clientName: i.clientName,
                amount: i.amount
            }
        })

        this.smartTableSource.load(incomeVM);
    }

    ngOnDestroy() {
        this._ngDestroy$.next();
        this._ngDestroy$.complete();
    }
}
