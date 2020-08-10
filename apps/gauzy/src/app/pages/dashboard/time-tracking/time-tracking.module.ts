import { NgModule } from '@angular/core';
import { TimeTrackingComponent } from './time-tracking.component';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../../../@shared/shared.module';
import { NbCardModule, NbSpinnerModule, NbListModule } from '@nebular/theme';
import { ScreenshotsItemModule } from '../../../@shared/timesheet/screenshots/screenshots-item/screenshots-item.module';
import { ActivityItemModule } from '../../../@shared/timesheet/activities/activity-item/activity-item.module';

@NgModule({
	imports: [
		CommonModule,
		SharedModule,
		NbCardModule,
		ScreenshotsItemModule,
		ActivityItemModule,
		NbSpinnerModule,
		NbListModule
	],
	declarations: [TimeTrackingComponent],
	exports: [TimeTrackingComponent],
	providers: []
})
export class TimeTrackingModule {}
