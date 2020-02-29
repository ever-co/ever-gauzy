import { Component, Input } from '@angular/core';

@Component({
	selector: 'ngx-date-view',
	template: `
		<span
			>{{ value | date: 'shortDate' }}
			<nb-icon
				*ngIf="rowData?.recurring"
				nbTooltip="{{ 'POP_UPS.RECURRING_EXPENSE' | translate }}"
				icon="sync-outline"
			>
			</nb-icon>
		</span>
	`,
	styles: []
})
export class DateViewComponent {
	@Input() value: Date;

	@Input()
	rowData: any;
}
