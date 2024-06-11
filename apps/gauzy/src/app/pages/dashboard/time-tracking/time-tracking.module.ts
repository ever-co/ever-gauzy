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
import { NgxPermissionsModule } from 'ngx-permissions';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { SwiperModule } from 'swiper/angular';
import { TimeTrackingComponent } from './time-tracking.component';
import {
	ActivityItemModule,
	GalleryModule,
	ScreenshotsItemModule,
	SharedModule,
	TimezoneFilterModule
} from '@gauzy/ui-sdk/shared';
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
		NbPopoverModule,
		ScreenshotsItemModule,
		ActivityItemModule,
		NgChartsModule,
		I18nTranslateModule.forChild(),
		GalleryModule,
		CounterPointModule,
		WidgetLayoutModule,
		WindowLayoutModule,
		SwiperModule,
		TimezoneFilterModule,
		NgxPermissionsModule.forChild()
	],
	declarations: [TimeTrackingComponent],
	exports: [TimeTrackingComponent],
	providers: []
})
export class TimeTrackingModule {}
