import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbButtonModule, NbIconModule, NbInputModule } from '@nebular/theme';
import { NgxDaterangepickerMd as NgxDateRangePickerMd } from 'ngx-daterangepicker-material';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
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
		I18nTranslateModule.forChild(),
		NbInputModule,
		NbButtonModule,
		NbIconModule
	],
	exports: [DateRangePickerComponent]
})
export class DateRangePickerModule {}
