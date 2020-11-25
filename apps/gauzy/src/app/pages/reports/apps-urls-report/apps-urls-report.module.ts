import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AppsUrlsReportRoutingModule } from './apps-urls-report-routing.module';
import { AppsUrlsReportComponent } from './apps-urls-report/apps-urls-report.component';
import { FormsModule } from '@angular/forms';
import {
	NbIconModule,
	NbSpinnerModule,
	NbCardModule,
	NbSelectModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { FiltersModule } from '../../../@shared/timesheet/filters/filters.module';
import { ActivitiesReportGridModule } from '../../../@shared/report/activities-report-grid/activities-report-grid.module';

@NgModule({
	declarations: [AppsUrlsReportComponent],
	imports: [
		CommonModule,
		AppsUrlsReportRoutingModule,

		TranslateModule,
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		FiltersModule,
		NbSelectModule,
		FormsModule,
		ActivitiesReportGridModule
	]
})
export class AppsUrlsReportModule {}
