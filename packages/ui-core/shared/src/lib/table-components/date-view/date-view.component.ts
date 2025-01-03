import { Component, Input } from '@angular/core';

@Component({
    selector: 'ngx-date-view',
    template: `
		<span>
			{{ value | dateFormat }}
			<nb-icon
				*ngIf="rowData?.recurring"
				[nbTooltip]="'POP_UPS.RECURRING_EXPENSE' | translate"
				icon="sync-outline"
			></nb-icon>
		</span>
	`,
    styles: [],
    standalone: false
})
export class DateViewComponent {
	@Input() value: Date | string;
	@Input() rowData: any;
}
