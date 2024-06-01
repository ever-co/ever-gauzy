import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbButtonModule, NbIconModule, NbInputModule } from '@nebular/theme';
import { NgxDaterangepickerMd as NgxDateRangePickerMd } from 'ngx-daterangepicker-material';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { WeekDaysEnum } from '@gauzy/contracts';
import { DateRangePickerComponent } from './date-range-picker.component';
import { dayOfWeekAsString } from './date-picker.utils';

@NgModule({
	declarations: [DateRangePickerComponent],
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NgxDateRangePickerMd.forRoot({
			firstDay: dayOfWeekAsString(WeekDaysEnum.MONDAY)
		}),
		TranslateModule.forChild(),
		NbInputModule,
		NbButtonModule,
		NbIconModule
	],
	exports: [DateRangePickerComponent]
})
export class DateRangePickerModule {}
