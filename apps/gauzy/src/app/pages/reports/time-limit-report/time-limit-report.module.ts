import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TimeLimitReportRoutingModule } from './time-limit-report-routing.module';
import { TimeLimitReportComponent } from './time-limit-report/time-limit-report.component';
import { FormsModule } from '@angular/forms';
import {
	NbIconModule,
	NbSpinnerModule,
	NbCardModule,
	NbSelectModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { ProgressStatusModule } from '../../../@shared/progress-status/progress-status.module';
import { LineChartModule } from '../../../@shared/report/charts/line-chart/line-chart.module';
import { SharedModule } from '../../../@shared/shared.module';
import { FiltersModule } from '../../../@shared/timesheet/filters/filters.module';
import { HeaderTitleModule } from '../../../@shared/components/header-title/header-title.module';
import { DateRangeTitleModule } from '../../../@shared/components/date-range-title/date-range-title.module';
import { GauzyRangePickerModule } from '../../../@shared/timesheet/gauzy-range-picker/gauzy-range-picker.module';

@NgModule({
	declarations: [TimeLimitReportComponent],
	imports: [
		CommonModule,
		TimeLimitReportRoutingModule,
		SharedModule,
		TranslateModule,
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		FiltersModule,
		NbSelectModule,
		FormsModule,
		LineChartModule,
		ProgressStatusModule,
		HeaderTitleModule,
		DateRangeTitleModule,
    	GauzyRangePickerModule
	]
})
export class TimeLimitReportModule {}
