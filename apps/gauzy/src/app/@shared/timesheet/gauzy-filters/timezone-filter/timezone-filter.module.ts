import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbIconModule, NbPopoverModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { TimezoneFilterComponent } from './timezone-filter.component';

@NgModule({
	declarations: [TimezoneFilterComponent],
	imports: [CommonModule, I18nTranslateModule.forChild(), NbIconModule, NbButtonModule, NbPopoverModule],
	exports: [TimezoneFilterComponent]
})
export class TimezoneFilterModule {}
