import { Component, Input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { NbIconModule, NbTooltipModule } from '@nebular/theme';
import { DateFormatPipe } from '../../pipes/date-format.pipe';

@Component({
	selector: 'ngx-date-view',
	template: `
		<span>
			{{ value | dateFormat }}
			@if (rowData?.recurring) {
				<nb-icon [nbTooltip]="'POP_UPS.RECURRING_EXPENSE' | translate" icon="sync-outline"></nb-icon>
			}
		</span>
	`,
	styles: [],
	standalone: true,
	imports: [TranslateModule, NbIconModule, NbTooltipModule, DateFormatPipe]
})
export class DateViewComponent {
	@Input() value: Date | string;
	@Input() rowData: any;
}
