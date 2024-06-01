import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NbSpinnerModule, NbButtonModule, NbDialogModule, NbIconModule, NbCheckboxModule } from '@nebular/theme';
import { MomentModule } from 'ngx-moment';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';

import { ScreenshotRoutingModule } from './screenshot-routing.module';
import { ScreenshotComponent } from './screenshot/screenshot.component';

import { SharedModule } from './../../../../@shared/shared.module';
import { ViewTimeLogModalModule } from './../../../../@shared/timesheet/view-time-log-modal/view-time-log-modal.module';
import { ScreenshotsItemModule } from './../../../../@shared/timesheet/screenshots/screenshots-item/screenshots-item.module';
import { GalleryModule } from './../../../../@shared/gallery/gallery.module';
import { GauzyFiltersModule } from './../../../../@shared/timesheet/gauzy-filters/gauzy-filters.module';
import { DailyStatisticsModule } from 'apps/gauzy/src/app/@shared/report/daily-statistics/daily-statistics.module';
import { NoDataMessageModule } from 'apps/gauzy/src/app/@shared/no-data-message/no-data-message.module';

@NgModule({
	declarations: [ScreenshotComponent],
	imports: [
		CommonModule,
		ScreenshotRoutingModule,
		SharedModule,
		NbSpinnerModule,
		MomentModule,
		TranslateModule.forChild(),
		NbButtonModule,
		NbDialogModule.forChild(),
		ViewTimeLogModalModule,
		NbIconModule,
		NbCheckboxModule,
		FormsModule,
		ReactiveFormsModule,
		ScreenshotsItemModule,
		GalleryModule,
		GauzyFiltersModule,
		DailyStatisticsModule,
		NoDataMessageModule
	]
})
export class ScreenshotModule {}
