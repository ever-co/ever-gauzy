import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbIconModule, NbSpinnerModule, NbCardModule, NbSelectModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { ActivitiesReportGridModule, GauzyFiltersModule, SharedModule } from '@gauzy/ui-sdk/shared';
import { AppsUrlsReportRoutingModule } from './apps-urls-report-routing.module';
import { AppsUrlsReportComponent } from './apps-urls-report/apps-urls-report.component';

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
