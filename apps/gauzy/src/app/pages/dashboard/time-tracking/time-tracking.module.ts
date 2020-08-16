import { NgModule } from '@angular/core';
import { TimeTrackingComponent } from './time-tracking.component';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../../../@shared/shared.module';
import {
	NbCardModule,
	NbSpinnerModule,
	NbListModule,
	NbProgressBarModule,
	NbBadgeModule
} from '@nebular/theme';
import { ScreenshotsItemModule } from '../../../@shared/timesheet/screenshots/screenshots-item/screenshots-item.module';
import { ActivityItemModule } from '../../../@shared/timesheet/activities/activity-item/activity-item.module';
import { ChartModule } from 'angular2-chartjs';

@NgModule({
	imports: [
		CommonModule,
		SharedModule,
		NbCardModule,
		ScreenshotsItemModule,
		ActivityItemModule,
		NbSpinnerModule,
		NbListModule,
		NbProgressBarModule,
		ChartModule,
		NbBadgeModule
	],
	declarations: [TimeTrackingComponent],
	exports: [TimeTrackingComponent],
	providers: []
})
export class TimeTrackingModule {}
