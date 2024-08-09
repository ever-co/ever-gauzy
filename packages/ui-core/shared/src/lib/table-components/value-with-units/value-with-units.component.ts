import { Component, Input } from '@angular/core';

@Component({
	selector: 'ga-value-with-unit',
	template: ` <span> {{ value }} {{ rowData.unit }} </span> `
})
export class ValueWithUnitComponent {
	@Input() value: String;
	@Input() rowData: any;
}
