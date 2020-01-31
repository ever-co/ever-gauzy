import { Component, Input } from '@angular/core';

@Component({
	selector: 'ngx-date-view',
	template: `
		<span
			>{{ value | date: 'shortDate' }}
			<i *ngIf="rowData?.recurring" class="fas fa-sync"></i
		></span>
	`,
	styles: []
})
export class DateViewComponent {
	@Input() value: Date;

	@Input()
	rowData: any;
}
