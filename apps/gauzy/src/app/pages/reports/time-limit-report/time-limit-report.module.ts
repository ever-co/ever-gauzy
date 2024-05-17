import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TimeLimitReportRoutingModule } from './time-limit-report-routing.module';
import { TimeLimitReportComponent } from './time-limit-report/time-limit-report.component';
import { FormsModule } from '@angular/forms';
import { NbIconModule, NbSpinnerModule, NbCardModule, NbSelectModule } from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { ProgressStatusModule } from '../../../@shared/progress-status/progress-status.module';
import { LineChartModule } from '../../../@shared/report/charts/line-chart/line-chart.module';
import { SharedModule } from '../../../@shared/shared.module';
import { HeaderTitleModule } from '../../../@shared/components/header-title/header-title.module';
import { DateRangeTitleModule } from '../../../@shared/components/date-range-title/date-range-title.module';
import { GauzyFiltersModule } from '../../../@shared/timesheet/gauzy-filters/gauzy-filters.module';
import { ProjectColumnViewModule } from '../../../@shared/report/project-column-view/project-column-view.module';

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
		NbSelectModule,
		FormsModule,
		LineChartModule,
		ProgressStatusModule,
		HeaderTitleModule,
		DateRangeTitleModule,
		GauzyFiltersModule,
		ProjectColumnViewModule
	]
})
export class TimeLimitReportModule {}
