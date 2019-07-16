import { Component, OnInit, OnDestroy } from '@angular/core';
import { IncomeService } from '../../@core/services/income.service';
import { first, takeUntil } from 'rxjs/operators';
import { Store } from '../../@core/services/store.service';
import { Subject } from 'rxjs';


@Component({
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit, OnDestroy {
    private _ngDestroy$ = new Subject<void>();

    selectedDate: Date;
    selectedEmployeeId: string;

    constructor(private incomeService: IncomeService,
                private store: Store) { }

    ngOnInit() {
        this.store.selectedEmployeeId$
            .pipe(takeUntil(this._ngDestroy$))
            .subscribe(id => {
                this.selectedEmployeeId = id;

                if (this.selectedDate) {
                    this._loadEmployeeTotalIncome();
                }
            });

        this.store.selectedDate$
            .pipe(takeUntil(this._ngDestroy$))
            .subscribe(date => {
                this.selectedDate = date;

                if (this.selectedEmployeeId) {
                    this._loadEmployeeTotalIncome();
                }
            });
    }

    private async _loadEmployeeTotalIncome() {
        const { items } = await this.incomeService
        .getAll(['employee'], {
            employee: {
                id: this.selectedEmployeeId
            }
        }, this.selectedDate)
        .pipe(first())
        .toPromise();

        console.log(items);
    }

    ngOnDestroy() {
        this._ngDestroy$.next();
        this._ngDestroy$.complete();
    }
}
