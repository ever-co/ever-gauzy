import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppsUrlsReportRoutingModule } from './apps-urls-report-routing.module';
import { AppsUrlsReportComponent } from './apps-urls-report/apps-urls-report.component';
import { FormsModule } from '@angular/forms';
import { NbIconModule, NbSpinnerModule, NbCardModule, NbSelectModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { GauzyFiltersModule, SharedModule } from '@gauzy/ui-sdk/shared';
import { ActivitiesReportGridModule } from '../../../@shared/report/activities-report-grid/activities-report-grid.module';

@NgModule({
	declarations: [AppsUrlsReportComponent],
	imports: [
		CommonModule,
		AppsUrlsReportRoutingModule,
		SharedModule,
		I18nTranslateModule.forChild(),
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		NbSelectModule,
		FormsModule,
		ActivitiesReportGridModule,
		GauzyFiltersModule
	]
})
export class AppsUrlsReportModule {}
