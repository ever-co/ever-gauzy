import { NgModule } from '@angular/core';
import { NbIconModule, NbSpinnerModule, NbCardModule, NbSelectModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import {
	GauzyFiltersModule,
	LineChartModule,
	ProgressStatusModule,
	ProjectColumnViewModule,
	SharedModule
} from '@gauzy/ui-core/shared';
import { TimeLimitReportRoutingModule } from './time-limit-report-routing.module';
import { TimeLimitReportComponent } from './time-limit-report/time-limit-report.component';

@NgModule({
	declarations: [TimeLimitReportComponent],
	imports: [
		TimeLimitReportRoutingModule,
		SharedModule,
		TranslateModule.forChild(),
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		NbSelectModule,
		LineChartModule,
		ProgressStatusModule,
		GauzyFiltersModule,
		ProjectColumnViewModule
	]
})
export class TimeLimitReportModule {}
