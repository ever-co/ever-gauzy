import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { WeekDaysEnum } from '@gauzy/contracts';
import { NbButtonModule, NbIconModule, NbInputModule } from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@ngx-translate/core';
import { NgxDaterangepickerMd as NgxDateRangePickerMd } from 'ngx-daterangepicker-material';
import { RecapQuery } from '../../../+state/recap.query';
import { RecapStore } from '../../../+state/recap.store';
import { PipeModule } from '../../../../time-tracker/pipes/pipe.module';
import { dayOfWeekAsString } from './date-picker.utils';
import { DateRangePickerComponent } from './date-range-picker.component';

@NgModule({
	declarations: [DateRangePickerComponent],
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbIconModule,
		NbInputModule,
		NgSelectModule,
		TranslateModule,
		PipeModule,
		NgxDateRangePickerMd.forRoot({
			firstDay: dayOfWeekAsString(WeekDaysEnum.MONDAY)
		})
	],
	providers: [RecapStore, RecapQuery],
	exports: [DateRangePickerComponent]
})
export class DateRangePickerModule {}
