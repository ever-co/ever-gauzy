import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NbSpinnerModule, NbButtonModule, NbDialogModule, NbIconModule, NbCheckboxModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { MomentModule } from 'ngx-moment';
import {
	DailyStatisticsModule,
	GalleryModule,
	GauzyFiltersModule,
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
