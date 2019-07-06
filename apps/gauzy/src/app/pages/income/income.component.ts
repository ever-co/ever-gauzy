import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from '../../@core/services/auth.service';
import { RolesEnum } from '@gauzy/models';
import { Subject } from 'rxjs';
import { takeUntil, first } from 'rxjs/operators';
import { Store } from '../../@core/services/store.service';
import { IncomeService } from '../../@core/services/income.service';
import { FormBuilder, Validators } from '@angular/forms';

@Component({
    templateUrl: './income.component.html',
    styleUrls: ['./income.component.scss']
})
export class IncomeComponent implements OnInit, OnDestroy {
    private _ngDestroy$ = new Subject<void>();
    readonly form = this.fb.group({
        date: [new Date((new Date()).getFullYear(), (new Date()).getMonth() + 1, 0), Validators.required],
        amount: ['', Validators.required],
        clientName: ['', Validators.required]
    });

    hasRole: boolean;
    selectedEmployeeId: string;

    date = this.form.get('date');
    amount = this.form.get('amount');
    clientName = this.form.get('clientName');

    smartTableSettings = {
        actions: false,
        editable: true,
        noDataMessage: 'Please select Employee from the menu above.',
        columns: {
            date: {
                title: 'Date',
                type: 'string',
                filter: false
            },
            incomeType: {
                title: 'Income Type',
                type: 'string',
                filter: false
            },
            bonus: {
                title: 'Value',
                type: 'number',
                width: '15%',
                filter: false
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
                private readonly fb: FormBuilder,) { }

    async ngOnInit() {
        this.hasRole = await this.authService
            .hasRole([RolesEnum.ADMIN, RolesEnum.DATA_ENTRY])
            .pipe(first())
            .toPromise()

        this.store.selectedEmployeeId$
            .pipe(takeUntil(this._ngDestroy$))
            .subscribe(id => {this.selectedEmployeeId = id; console.log(this.selectedEmployeeId)});

        
    }

    async addIncome() {
        await this.incomeService.create({
            valueDate: this.date.value,
            amount: this.amount.value,
            clientName: this.clientName.value,
            clientId: Math.floor(Math.random() * 101) + 1,
            employeeId: this.selectedEmployeeId
        }).pipe(first()).toPromise();
    }

    private _loadEmployeeIncomeData(id: string) {
        
    }

    ngOnDestroy() {
        this._ngDestroy$.next();
        this._ngDestroy$.complete();
    }
}
