import { DefaultEditor } from 'ng2-smart-table';
import { OnInit, OnDestroy, Component } from '@angular/core';
import { Expense } from '@gauzy/models';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Store } from '../../../@core/services/store.service';
import { ExpensesService } from '../../../@core/services/expenses.service';

@Component({
	template: `
		<nb-select
			fullWidth
			placeholder="Select Expense"
			[(ngModel)]="expense"
			(selectedChange)="selectExpense($event)"
		>
			<nb-option *ngFor="let expense of expenses" [value]="expense">
				{{ expense.purpose }}
			</nb-option>
		</nb-select>
	`,
	styles: []
})
export class InvoiceExpensesSelectorComponent extends DefaultEditor
	implements OnInit, OnDestroy {
	expense: Expense;
	expenses: Expense[];
	private _ngDestroy$ = new Subject<void>();

	constructor(
		private store: Store,
		private expensesService: ExpensesService
	) {
		super();
	}

	ngOnInit() {
		this._loadExpenses();
	}

	private async _loadExpenses() {
		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (organization) => {
				if (organization) {
					const expenses = await this.expensesService.getAll([], {
						typeOfExpense: 'Billable to Contact',
						organization: {
							id: organization.id
						}
					});
					this.expenses = expenses.items;
					const expense = this.expenses.find(
						(e) => e.id === this.cell.newValue
					);
					this.expense = expense;
				}
			});
	}

	selectExpense($event) {
		this.cell.newValue = $event.id;
	}

	ngOnDestroy() {}
}
