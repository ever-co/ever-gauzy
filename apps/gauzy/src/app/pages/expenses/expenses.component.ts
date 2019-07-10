import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from '../../@core/services/auth.service';
import { RolesEnum } from '@gauzy/models';
import { first, takeUntil } from 'rxjs/operators';
import { NbDialogService } from '@nebular/theme';
import { ExpensesMutationComponent } from '../../@shared/expenses/expenses-mutation/expenses-mutation.component';
import { Store } from '../../@core/services/store.service';
import { Subject } from 'rxjs';

@Component({
    templateUrl: './expenses.component.html',
    styleUrls: ['./expenses.component.scss'],
})

export class ExpensesComponent implements OnInit, OnDestroy {
    private _ngDestroy$ = new Subject<void>();

    hasRole: boolean;

    smartTableSettings = {
        actions: false,
        editable: true,
        noDataMessage: 'No data for the currently selected Employee & Organization.',
        columns: {
            date: {
                title: 'Date',
                type: 'string'
            },
            vendorName: {
                title: 'Vendor',
                type: 'string'
            },
            amount: {
                title: 'Value',
                type: 'number',
            },
            categoryName: {
                title: 'Category',
                type: 'string'
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



    constructor(private authService: AuthService,
                private dialogService: NbDialogService,
                private store: Store) { }

    async ngOnInit() {
        this.hasRole = await this.authService
            .hasRole([RolesEnum.ADMIN, RolesEnum.DATA_ENTRY])
            .pipe(first())
            .toPromise();

        this.store.selectedOrganizationId$
            .pipe(takeUntil(this._ngDestroy$))
            .subscribe(id => console.log(id));

        this.store.selectedEmployeeId$ 
            .pipe(takeUntil(this._ngDestroy$))
            .subscribe(id => console.log(id));
    }

    openAddExpenseDialog() {
        this.dialogService.open(ExpensesMutationComponent);
    }

    ngOnDestroy() {
        this._ngDestroy$.next();
        this._ngDestroy$.complete();
    }
}