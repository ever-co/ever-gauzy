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
	NbPopoverModule
} from '@nebular/theme';
import { FormsModule } from '@angular/forms';
import { NgChartsModule } from 'ng2-charts';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { SwiperModule } from 'swiper/angular';
import { TimeTrackingComponent } from './time-tracking.component';
import { SharedModule } from '../../../@shared/shared.module';
import { ScreenshotsItemModule } from '../../../@shared/timesheet/screenshots/screenshots-item/screenshots-item.module';
import { ActivityItemModule } from '../../../@shared/timesheet/activities/activity-item/activity-item.module';
import { GalleryModule } from '../../../@shared/gallery/gallery.module';
import { HeaderTitleModule } from '../../../@shared/components/header-title/header-title.module';
import { DateRangeTitleModule } from '../../../@shared/components/date-range-title/date-range-title.module';
import { CounterPointModule } from '../../../@shared/counter-point/counter-point.module';
import { WidgetLayoutModule } from '../../../@shared/dashboard/widget-layout/widget-layout.module';
import { WindowLayoutModule } from '../../../@shared/dashboard/window-layout/window-layout.module';

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
		NgChartsModule,
		TranslateModule,
		GalleryModule,
		HeaderTitleModule,
		DateRangeTitleModule,
		CounterPointModule,
		WidgetLayoutModule,
		WindowLayoutModule,
		NbPopoverModule,
		SwiperModule
	],
	declarations: [TimeTrackingComponent],
	exports: [TimeTrackingComponent],
	providers: []
})
export class TimeTrackingModule {}
