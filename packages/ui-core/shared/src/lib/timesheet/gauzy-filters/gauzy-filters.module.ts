import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbButtonModule, NbIconModule, NbPopoverModule, NbSelectModule } from '@nebular/theme';
import { NgxSliderModule } from '@angular-slider/ngx-slider';
import { TranslateModule } from '@ngx-translate/core';
import { PipesModule } from '../../pipes/pipes.module';
import { GauzyFiltersComponent } from './gauzy-filters.component';
import { TimezoneFilterModule } from './timezone-filter/timezone-filter.module';

@NgModule({
	declarations: [GauzyFiltersComponent],
	exports: [GauzyFiltersComponent],
	imports: [
		CommonModule,
		FormsModule,
		NbButtonModule,
		NbIconModule,
		NbPopoverModule,
		NbSelectModule,
		NgxSliderModule,
		TranslateModule.forChild(),
		PipesModule,
		TimezoneFilterModule
	]
})
export class GauzyFiltersModule {}
