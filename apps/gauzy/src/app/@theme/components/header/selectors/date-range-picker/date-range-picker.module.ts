import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbButtonModule, NbIconModule, NbInputModule } from '@nebular/theme';
import { NgxDaterangepickerMd as NgxDateRangePickerMd } from 'ngx-daterangepicker-material';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { DateRangePickerComponent } from './date-range-picker.component';

@NgModule({
	declarations: [DateRangePickerComponent],
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NgxDateRangePickerMd,
		TranslateModule,
		NbInputModule,
		NbButtonModule,
		NbIconModule
	],
	exports: [DateRangePickerComponent]
})
export class DateRangePickerModule {}
