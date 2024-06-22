import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbButtonModule, NbIconModule, NbPopoverModule, NbSelectModule } from '@nebular/theme';
import { NgxSliderModule } from '@angular-slider/ngx-slider';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { PipesModule } from '../../pipes/pipes.module';
import { i4netFiltersComponent } from './gauzy-filters.component';
import { TimezoneFilterModule } from './timezone-filter/timezone-filter.module';

@NgModule({
	declarations: [i4netFiltersComponent],
	exports: [i4netFiltersComponent],
	imports: [
		CommonModule,
		FormsModule,
		NbButtonModule,
		NbIconModule,
		NbPopoverModule,
		NbSelectModule,
		NgxSliderModule,
		I18nTranslateModule.forChild(),
		PipesModule,
		TimezoneFilterModule
	]
})
export class i4netFiltersModule { }
