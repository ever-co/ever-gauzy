import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ScreenshotRoutingModule } from './screenshot-routing.module';
import { ScreenshotComponent } from './screenshot/screenshot.component';
import { SharedModule } from 'apps/gauzy/src/app/@shared/shared.module';
import { FiltersModule } from 'apps/gauzy/src/app/@shared/timesheet/filters/filters.module';
import {
	NbSpinnerModule,
	NbButtonModule,
	NbDialogModule,
	NbIconModule,
	NbCheckboxModule
} from '@nebular/theme';
import { MomentModule } from 'ngx-moment';
import { TranslateModule } from '@ngx-translate/core';
import { ViewTimeLogModalModule } from 'apps/gauzy/src/app/@shared/timesheet/view-time-log-modal/view-time-log-modal.module';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ScreenshotsItemModule } from 'apps/gauzy/src/app/@shared/timesheet/screenshots/screenshots-item/screenshots-item.module';
import { GalleryModule } from 'apps/gauzy/src/app/@shared/gallery/gallery.module';

@NgModule({
	declarations: [ScreenshotComponent],
	imports: [
		CommonModule,
		ScreenshotRoutingModule,
		SharedModule,
		FiltersModule,
		NbSpinnerModule,
		MomentModule,
		TranslateModule,
		NbButtonModule,
		NbDialogModule.forChild(),
		ViewTimeLogModalModule,
		NbIconModule,
		NbCheckboxModule,
		FormsModule,
		ReactiveFormsModule,
		ScreenshotsItemModule,
		GalleryModule
	]
})
export class ScreenshotModule {}
