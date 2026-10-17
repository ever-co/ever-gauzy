import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbIconModule, NbPopoverModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { TimezoneFilterComponent } from './timezone-filter.component';

@NgModule({
	imports: [CommonModule, NbButtonModule, NbIconModule, NbPopoverModule, TranslatePipe],
	declarations: [TimezoneFilterComponent],
	exports: [TimezoneFilterComponent]
})
export class TimezoneFilterModule {}
