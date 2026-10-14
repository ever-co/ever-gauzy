import { NgModule } from '@angular/core';
import { NbIconModule, NbSpinnerModule, NbCardModule, NbSelectModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import {
	GauzyFiltersModule,
	LineChartModule,
	NoDataMessageModule,
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
		TranslatePipe,
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		NbSelectModule,
		LineChartModule,
		ProgressStatusModule,
		GauzyFiltersModule,
		ProjectColumnViewModule,
		NoDataMessageModule
	]
})
export class TimeLimitReportModule {}
