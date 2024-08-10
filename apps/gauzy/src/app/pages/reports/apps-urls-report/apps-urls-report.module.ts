import { NgModule } from '@angular/core';
import { NbIconModule, NbSpinnerModule, NbCardModule, NbSelectModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { ActivitiesReportGridModule, GauzyFiltersModule, SharedModule } from '@gauzy/ui-core/shared';
import { AppsUrlsReportRoutingModule } from './apps-urls-report-routing.module';
import { AppsUrlsReportComponent } from './apps-urls-report/apps-urls-report.component';

@NgModule({
	declarations: [AppsUrlsReportComponent],
	imports: [
		AppsUrlsReportRoutingModule,
		SharedModule,
		TranslateModule.forChild(),
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		NbSelectModule,
		ActivitiesReportGridModule,
		GauzyFiltersModule
	]
})
export class AppsUrlsReportModule {}
