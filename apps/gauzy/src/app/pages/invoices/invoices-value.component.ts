import { Component, Input } from '@angular/core';

@Component({
	selector: 'ga-invoice-value',
	template: `
		<span>{{ rowData.currency }} {{ value }} </span>
	`,
	styles: []
})
export class InvoicesValueComponent {
	@Input() value: Date;

	@Input()
	rowData: any;
}
