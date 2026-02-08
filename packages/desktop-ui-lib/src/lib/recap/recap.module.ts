import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import {
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbLayoutModule,
	NbListModule,
	NbPopoverModule,
	NbProgressBarModule,
	NbRouteTabsetModule,
	NbSpinnerModule,
	NbTableModule,
	NbToggleModule
} from '@nebular/theme';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { ToastrNotificationService } from '../services';

import { TranslateModule } from '@ngx-translate/core';
import { PipeModule } from '../time-tracker/pipes/pipe.module';
import { AutoRefreshQuery } from './+state/auto-refresh/auto-refresh.query';
import { AutoRefreshService } from './+state/auto-refresh/auto-refresh.service';
import { AutoRefreshStore } from './+state/auto-refresh/auto-refresh.store';
import { RecapQuery } from './+state/recap.query';
import { RecapService } from './+state/recap.service';
import { RecapStore } from './+state/recap.store';
import { RequestQuery } from './+state/request/request.query';
import { RequestStore } from './+state/request/request.store';
import { recapRoutes } from './recap-routing.module';
import { ActivityService, TimesheetService, TimesheetStatisticsService } from './services/timesheet';
import { DateRangePickerModule } from './shared/features/date-range-picker/date-range-picker.module';
import { GauzyFiltersModule } from './shared/features/gauzy-filters';

@NgModule({
	imports: [
		CommonModule,
		NbLayoutModule,
		NbCardModule,
		NbListModule,
		NbProgressBarModule,
		NbIconModule,
		NbButtonModule,
		NbPopoverModule,
		NbTableModule,
		NgxChartsModule,
		NbRouteTabsetModule,
		PipeModule,
		DateRangePickerModule,
		GauzyFiltersModule,
		NbBadgeModule,
		NbToggleModule,
		NbSpinnerModule,
		TranslateModule.forChild(),
		RouterModule.forChild(recapRoutes)
	],
	providers: [
		RecapQuery,
		RecapStore,
		RecapService,
		ToastrNotificationService,
		TimesheetService,
		TimesheetStatisticsService,
		ActivityService,
		AutoRefreshService,
		AutoRefreshQuery,
		AutoRefreshStore,
		RequestQuery,
		RequestStore
	]
})
export class RecapModule {}
