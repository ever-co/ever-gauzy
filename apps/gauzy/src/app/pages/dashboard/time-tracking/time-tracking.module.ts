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
	NbButtonModule
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
import { DateRangeTitleModule } from '../../../@shared/components/date-range-title/date-range-title.module';
import { GauzyRangePickerModule } from '../../../@shared/timesheet/gauzy-range-picker/gauzy-range-picker.module';

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
		DateRangeTitleModule,
		FiltersModule,
    GauzyRangePickerModule
	],
	declarations: [TimeTrackingComponent],
	exports: [TimeTrackingComponent],
	providers: []
})
export class TimeTrackingModule {}
