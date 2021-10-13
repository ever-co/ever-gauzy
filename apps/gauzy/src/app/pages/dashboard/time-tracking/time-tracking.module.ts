import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
	NbCardModule,
	NbSpinnerModule,
	NbListModule,
	NbProgressBarModule,
	NbBadgeModule,
	NbToggleModule,
	NbIconModule,
	NbButtonModule,
	NbCalendarRangeModule,
	NbInputModule,
	NbDatepickerModule
} from '@nebular/theme';
import { FormsModule } from '@angular/forms';
import { ChartModule } from 'angular2-chartjs';
import { TranslateModule } from '@ngx-translate/core';
import { TimeTrackingComponent } from './time-tracking.component';
import { SharedModule } from '../../../@shared/shared.module';
import { ScreenshotsItemModule } from '../../../@shared/timesheet/screenshots/screenshots-item/screenshots-item.module';
import { ActivityItemModule } from '../../../@shared/timesheet/activities/activity-item/activity-item.module';
import { GalleryModule } from '../../../@shared/gallery/gallery.module';
import { HeaderTitleModule } from '../../../@shared/components/header-title/header-title.module';
import { FiltersModule } from '../../../@shared/timesheet/filters/filters.module';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		SharedModule,
		NbCardModule,
		NbButtonModule,
		NbSpinnerModule,
		NbListModule,
		NbProgressBarModule,
		NbToggleModule,
		NbIconModule,
		NbBadgeModule,
		ScreenshotsItemModule,
		ActivityItemModule,
		ChartModule,
		TranslateModule,
		GalleryModule,
		HeaderTitleModule,
		FiltersModule,
		NbCalendarRangeModule,
		NbInputModule,
		NbDatepickerModule
	],
	declarations: [TimeTrackingComponent],
	exports: [TimeTrackingComponent],
	providers: []
})
export class TimeTrackingModule {}
