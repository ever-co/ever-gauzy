import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NbSpinnerModule, NbButtonModule, NbDialogModule, NbIconModule, NbCheckboxModule } from '@nebular/theme';
import { MomentModule } from 'ngx-moment';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import {
	DailyStatisticsModule,
	GalleryModule,
	i4netFiltersModule,
	NoDataMessageModule,
	ScreenshotsItemModule,
	SharedModule,
	ViewTimeLogModalModule
} from '@gauzy/ui-core/shared';
import { ScreenshotRoutingModule } from './screenshot-routing.module';
import { ScreenshotComponent } from './screenshot/screenshot.component';

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
		i4netFiltersModule,
		DailyStatisticsModule,
		NoDataMessageModule
	]
})
export class ScreenshotModule { }
