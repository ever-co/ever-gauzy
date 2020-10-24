import { DefaultEditor } from 'ng2-smart-table';
import { OnInit, OnDestroy, Component } from '@angular/core';
import { IExpense } from '@gauzy/models';
import { Store } from '../../../@core/services/store.service';
import { ExpensesService } from '../../../@core/services/expenses.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
@UntilDestroy({ checkProperties: true })
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
export class InvoiceExpensesSelectorComponent
	extends DefaultEditor
	implements OnInit, OnDestroy {
	expense: IExpense;
	expenses: IExpense[];

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
			.pipe(untilDestroyed(this))
			.subscribe(async (organization) => {
				if (organization) {
					const tenantId = this.store.user.tenantId;
					const { id: organizationId } = organization;
					const expenses = await this.expensesService.getAll([], {
						typeOfExpense: 'Billable to Contact',
						organizationId,
						tenantId
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
