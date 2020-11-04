import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TimeReportsRoutingModule } from './time-reports-routing.module';
import { TimeReportsComponent } from './time-reports/time-reports.component';
import { TimeReportHorizontalBarChartModule } from '../time-report-horizontal-bar-chart/time-report-horizontal-bar-chart.module';
import { SharedModule } from '../../../@shared/shared.module';
import { TranslateModule } from '@ngx-translate/core';
import {
	NbCardModule,
	NbIconModule,
	NbSelectModule,
	NbSpinnerModule
} from '@nebular/theme';
import { FiltersModule } from '../../../@shared/timesheet/filters/filters.module';
import { FormsModule } from '@angular/forms';

@NgModule({
	declarations: [TimeReportsComponent],
	imports: [
		CommonModule,
		SharedModule,
		TimeReportsRoutingModule,
		TimeReportHorizontalBarChartModule,
		TranslateModule,
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		FiltersModule,
		NbSelectModule,
		FormsModule
	]
})
export class TimeReportsModule {}
