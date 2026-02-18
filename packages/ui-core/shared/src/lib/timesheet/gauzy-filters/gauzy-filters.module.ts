import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbButtonModule, NbIconModule, NbPopoverModule, NbSelectModule } from '@nebular/theme';
import { NgxSliderModule } from '@angular-slider/ngx-slider';
import { TranslateModule } from '@ngx-translate/core';
import { GauzyFiltersComponent } from './gauzy-filters.component';
import { TimezoneFilterModule } from './timezone-filter/timezone-filter.module';
import { ReplacePipe } from '../../pipes/replace.pipe';

@NgModule({
	declarations: [GauzyFiltersComponent],
	exports: [GauzyFiltersComponent],
	imports: [
		CommonModule,
		ReplacePipe,
		FormsModule,
		NbButtonModule,
		NbIconModule,
		NbPopoverModule,
		NbSelectModule,
		NgxSliderModule,
		TranslateModule.forChild(),
		TimezoneFilterModule
	]
})
export class GauzyFiltersModule {}
