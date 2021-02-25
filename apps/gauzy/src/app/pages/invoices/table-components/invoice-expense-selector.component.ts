import { DefaultEditor } from 'ng2-smart-table';
import { OnInit, OnDestroy, Component } from '@angular/core';
import { ExpenseTypesEnum, IExpense, IOrganization } from '@gauzy/contracts';
import { Store } from '../../../@core/services/store.service';
import { ExpensesService } from '../../../@core/services/expenses.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs/operators';

@UntilDestroy({ checkProperties: true })
@Component({
	template: `
		<nb-select
			fullWidth
			placeholder="{{ 'FORM.PLACEHOLDERS.SELECT_EXPENSE' | translate }}"
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
	organization: IOrganization;

	constructor(
		private store: Store,
		private expensesService: ExpensesService
	) {
		super();
	}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				tap((organization) => (this.organization = organization)),
				tap(() => this._loadExpenses()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _loadExpenses() {
		const tenantId = this.store.user.tenantId;
		const { id: organizationId } = this.organization;

		this.expensesService
			.getAll([], {
				typeOfExpense: ExpenseTypesEnum.BILLABLE_TO_CONTACT,
				organizationId,
				tenantId
			})
			.then(({ items }) => {
				this.expenses = items;
				this.expense = this.expenses.find(
					(e) => e.id === this.cell.newValue.id
				);
			});
	}

	selectExpense($event) {
		this.cell.newValue = $event;
	}

	ngOnDestroy() {}
}
