import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
	selector: 'ga-value-with-unit',
	template: ` <span> {{ value }} {{ rowData.unit }} </span> `,
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class ValueWithUnitComponent {
	@Input() value: string;
	@Input() rowData: any;
}
