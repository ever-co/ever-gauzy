import { NgModule } from '@angular/core';
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
import { NgChartsModule } from 'ng2-charts';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateModule } from '@ngx-translate/core';
import { SwiperModule } from 'swiper/angular';
import { TimeTrackingComponent } from './time-tracking.component';
import {
	ActivityItemModule,
	CounterPointModule,
	GalleryModule,
	ScreenshotsItemModule,
	SharedModule,
	TimezoneFilterModule,
	WidgetLayoutModule,
	WindowLayoutModule
} from '@gauzy/ui-core/shared';

@NgModule({
	imports: [
		SharedModule,
		NbCardModule,
		NbButtonModule,
		NbSpinnerModule,
		NbListModule,
		NbProgressBarModule,
		NbToggleModule,
		NbIconModule,
		NbBadgeModule,
		NbPopoverModule,
		ScreenshotsItemModule,
		ActivityItemModule,
		NgChartsModule,
		TranslateModule.forChild(),
		GalleryModule,
		CounterPointModule,
		WidgetLayoutModule,
		WindowLayoutModule,
		SwiperModule,
		TimezoneFilterModule,
		NgxPermissionsModule.forChild()
	],
	declarations: [TimeTrackingComponent],
	exports: [TimeTrackingComponent]
})
export class TimeTrackingModule {}
