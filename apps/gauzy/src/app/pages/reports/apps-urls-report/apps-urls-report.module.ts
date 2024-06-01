import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppsUrlsReportRoutingModule } from './apps-urls-report-routing.module';
import { AppsUrlsReportComponent } from './apps-urls-report/apps-urls-report.component';
import { FormsModule } from '@angular/forms';
import { NbIconModule, NbSpinnerModule, NbCardModule, NbSelectModule } from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { ActivitiesReportGridModule } from '../../../@shared/report/activities-report-grid/activities-report-grid.module';
import { HeaderTitleModule } from '../../../@shared/components/header-title/header-title.module';
import { SharedModule } from './../../../@shared/shared.module';
import { DateRangeTitleModule } from '../../../@shared/components/date-range-title/date-range-title.module';
import { GauzyFiltersModule } from '../../../@shared/timesheet/gauzy-filters/gauzy-filters.module';

@NgModule({
	declarations: [AppsUrlsReportComponent],
	imports: [
		CommonModule,
		AppsUrlsReportRoutingModule,
		SharedModule,
		TranslateModule.forChild(),
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		NbSelectModule,
		FormsModule,
		ActivitiesReportGridModule,
		HeaderTitleModule,
		DateRangeTitleModule,
		GauzyFiltersModule
	]
})
export class AppsUrlsReportModule {}
