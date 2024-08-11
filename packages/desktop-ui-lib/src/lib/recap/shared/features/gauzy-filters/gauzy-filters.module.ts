import { NgxSliderModule } from '@angular-slider/ngx-slider';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NbButtonModule, NbCardModule, NbIconModule, NbPopoverModule, NbSelectModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { TimesheetFilterService } from '../../../services/timesheet';
import { PipeModule } from './../../../../time-tracker/pipes/pipe.module';
import { GauzyFiltersComponent } from './gauzy-filters.component';

@NgModule({
	declarations: [GauzyFiltersComponent],
	exports: [GauzyFiltersComponent],
	imports: [
		CommonModule,
		FormsModule,
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbPopoverModule,
		NbSelectModule,
		NgxSliderModule,
		TranslateModule,
		PipeModule
	],
	providers: [TimesheetFilterService]
})
export class GauzyFiltersModule {}
