import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
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
	NbTableModule,
	NbToggleModule
} from '@nebular/theme';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { LanguageModule } from '../language/language.module';
import { ToastrNotificationService } from '../services';
import { NoDataMessageModule } from '../time-tracker/no-data-message/no-data-message.module';
import { PipeModule } from '../time-tracker/pipes/pipe.module';
import { AutoRefreshQuery } from './+state/auto-refresh/auto-refresh.query';
import { AutoRefreshService } from './+state/auto-refresh/auto-refresh.service';
import { AutoRefreshStore } from './+state/auto-refresh/auto-refresh.store';
import { RecapQuery } from './+state/recap.query';
import { RecapService } from './+state/recap.service';
import { RecapStore } from './+state/recap.store';
import { RequestQuery } from './+state/request/request.query';
import { RequestStore } from './+state/request/request.store';
import { ActivitiesComponent } from './features/activities/activities.component';
import { FilterComponent } from './features/filter/filter.component';
import { ProjectsComponent } from './features/projects/projects.component';
import { RecapComponent } from './features/recap/recap.component';
import { TasksComponent } from './features/tasks/tasks.component';
import { TimeTrackingChartsComponent } from './features/time-tracking-charts/time-tracking-charts.component';
import { ActivityService, TimesheetService, TimesheetStatisticsService } from './services/timesheet';
import { DateRangePickerModule } from './shared/features/date-range-picker/date-range-picker.module';
import { GauzyFiltersModule } from './shared/features/gauzy-filters';
import { AutoRefeshComponent } from './shared/ui/auto-refesh/auto-refesh.component';
import { StatisticComponent } from './shared/ui/statistic/statistic.component';

@NgModule({
	declarations: [
		RecapComponent,
		ProjectsComponent,
		TasksComponent,
		ActivitiesComponent,
		TimeTrackingChartsComponent,
		FilterComponent,
		StatisticComponent,
		AutoRefeshComponent
	],
	imports: [
		CommonModule,
		NbLayoutModule,
		NbCardModule,
		NbListModule,
		NbProgressBarModule,
		NbIconModule,
		NbButtonModule,
		NoDataMessageModule,
		NbPopoverModule,
		NbTableModule,
		NgxChartsModule,
		NbRouteTabsetModule,
		PipeModule,
		DateRangePickerModule,
		GauzyFiltersModule,
		NbBadgeModule,
		NbToggleModule,
		LanguageModule.forChild()
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
