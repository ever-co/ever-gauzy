import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
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
	NbTableModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { LanguageSelectorService } from '../language/language-selector.service';
import { LanguageModule } from '../language/language.module';
import { ToastrNotificationService } from '../services';
import { NoDataMessageModule } from '../time-tracker/no-data-message/no-data-message.module';
import { PipeModule } from '../time-tracker/pipes/pipe.module';
import { RecapQuery } from './+state/recap.query';
import { RecapService } from './+state/recap.service';
import { RecapStore } from './+state/recap.store';
import { ActivitiesComponent } from './features/activities/activities.component';
import { FilterComponent } from './features/filter/filter.component';
import { ProjectsComponent } from './features/projects/projects.component';
import { RecapComponent } from './features/recap/recap.component';
import { TasksComponent } from './features/tasks/tasks.component';
import { TimeTrackingChartsComponent } from './features/time-tracking-charts/time-tracking-charts.component';
import { ActivityService, TimesheetService, TimesheetStatisticsService } from './services/timesheet';
import { DateRangePickerModule } from './shared/features/date-range-picker/date-range-picker.module';
import { GauzyFiltersModule } from './shared/features/gauzy-filters';
import { StatisticComponent } from './shared/ui/statistic/statistic.component';

@NgModule({
	declarations: [
		RecapComponent,
		ProjectsComponent,
		TasksComponent,
		ActivitiesComponent,
		TimeTrackingChartsComponent,
		FilterComponent,
		StatisticComponent
	],
	imports: [
		CommonModule,
		NbLayoutModule,
		HttpClientModule,
		NbCardModule,
		NbListModule,
		NbProgressBarModule,
		NbIconModule,
		TranslateModule,
		NbButtonModule,
		NoDataMessageModule,
		NbPopoverModule,
		NbTableModule,
		NgxChartsModule,
		NbRouteTabsetModule,
		PipeModule,
		DateRangePickerModule,
		GauzyFiltersModule,
		LanguageModule,
		NbBadgeModule
	],
	providers: [
		RecapQuery,
		RecapStore,
		RecapService,
		LanguageSelectorService,
		ToastrNotificationService,
		TimesheetService,
		TimesheetStatisticsService,
		ActivityService
	]
})
export class RecapModule {}
