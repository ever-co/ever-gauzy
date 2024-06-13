import { OnInit, OnDestroy, Component } from '@angular/core';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DefaultEditor } from 'angular2-smart-table';
import { ExpenseTypesEnum, IExpense, IOrganization } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/common';
import { ExpensesService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	template: `
		<nb-select
			fullWidth
			[placeholder]="'FORM.PLACEHOLDERS.SELECT_EXPENSE' | translate"
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
export class InvoiceExpensesSelectorComponent extends DefaultEditor implements OnInit, OnDestroy {
	public expense: IExpense;
	public expenses: IExpense[];
	public organization: IOrganization;

	constructor(private readonly store: Store, private readonly expensesService: ExpensesService) {
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
				//
				const expense: IExpense = this.cell.getNewRawValue();
				this.expense = this.expenses.find((e) => e.id === expense.id);
			});
	}

	/**
	 *
	 * @param $event
	 */
	selectExpense($event) {
		this.cell.setValue($event);
	}

	ngOnDestroy() {}
}
