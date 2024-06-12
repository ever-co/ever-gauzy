import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NbSpinnerModule, NbButtonModule, NbDialogModule, NbIconModule, NbCheckboxModule } from '@nebular/theme';
import { MomentModule } from 'ngx-moment';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import {
	GalleryModule,
	GauzyFiltersModule,
	ScreenshotsItemModule,
	SharedModule,
	ViewTimeLogModalModule
} from '@gauzy/ui-sdk/shared';
import { ScreenshotRoutingModule } from './screenshot-routing.module';
import { ScreenshotComponent } from './screenshot/screenshot.component';
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
		I18nTranslateModule.forChild(),
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
