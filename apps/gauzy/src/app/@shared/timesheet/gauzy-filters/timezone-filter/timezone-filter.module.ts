import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbIconModule, NbPopoverModule } from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { TimezoneFilterComponent } from './timezone-filter.component';

@NgModule({
	declarations: [TimezoneFilterComponent],
	imports: [CommonModule, TranslateModule.forChild(), NbIconModule, NbButtonModule, NbPopoverModule],
	exports: [TimezoneFilterComponent]
})
export class TimezoneFilterModule {}
