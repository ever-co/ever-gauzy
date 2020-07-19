import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ScreenshotRoutingModule } from './screenshot-routing.module';
import { ScreenshotComponent } from './screenshot/screenshot.component';
import { SharedModule } from 'apps/gauzy/src/app/@shared/shared.module';
import { FiltersModule } from 'apps/gauzy/src/app/@shared/timesheet/filters/filters.module';
import {
	NbSpinnerModule,
	NbProgressBarModule,
	NbButtonModule,
	NbDialogModule,
	NbIconModule,
	NbCheckboxModule
} from '@nebular/theme';
import { MomentModule } from 'ngx-moment';
import { GalleryModule } from 'apps/gauzy/src/app/@shared/gallery/gallery.module';
import { TranslateModule } from '@ngx-translate/core';
import { ViewTimeLogModalModule } from 'apps/gauzy/src/app/@shared/timesheet/view-time-log-modal/view-time-log-modal.module';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

@NgModule({
	declarations: [ScreenshotComponent],
	imports: [
		CommonModule,
		ScreenshotRoutingModule,
		SharedModule,
		FiltersModule,
		NbSpinnerModule,
		MomentModule,
		NbProgressBarModule,
		GalleryModule,
		TranslateModule,
		NbButtonModule,
		NbDialogModule.forChild(),
		ViewTimeLogModalModule,
		NbIconModule,
		NbCheckboxModule,
		FormsModule,
		ReactiveFormsModule
	]
})
export class ScreenshotModule {}
