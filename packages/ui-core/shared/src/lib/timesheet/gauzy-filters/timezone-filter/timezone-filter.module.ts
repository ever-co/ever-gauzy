import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbIconModule, NbPopoverModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { TimezoneFilterComponent } from './timezone-filter.component';

@NgModule({
	imports: [CommonModule, NbButtonModule, NbIconModule, NbPopoverModule, TranslateModule.forChild()],
	declarations: [TimezoneFilterComponent],
	exports: [TimezoneFilterComponent]
})
export class TimezoneFilterModule {}
