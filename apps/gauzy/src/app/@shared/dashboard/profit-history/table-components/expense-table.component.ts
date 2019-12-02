import { Component, Input } from '@angular/core';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';

@Component({
	template: `
		<span>{{
			rowData.expense ? '- ' + rowData.expense + ' ' + currency : ''
		}}</span>
	`
})
export class ExpenseTableComponent {
	constructor(private store: Store) {}
	currency = this.store.selectedOrganization.currency;

	@Input()
	rowData: any;
	value: string | number;
}
