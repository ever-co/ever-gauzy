import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbButtonModule, NbIconModule, NbSelectModule } from '@nebular/theme';
import { NgxSliderModule } from '@angular-slider/ngx-slider';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
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
		NbSelectModule,
		NgxSliderModule,
		PipesModule,
		TranslateModule,
		TimezoneFilterModule
	]
})
export class GauzyFiltersModule {}
