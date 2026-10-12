import { NgModule } from '@angular/core';
import { NbButtonModule, NbCheckboxModule, NbDialogModule, NbIconModule, NbSpinnerModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
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

// Nebular Modules
const NB_MODULES = [NbButtonModule, NbCheckboxModule, NbDialogModule.forChild(), NbIconModule, NbSpinnerModule];

@NgModule({
	declarations: [ScreenshotComponent],
	imports: [
		...NB_MODULES,
		MomentModule,
		TranslatePipe,
		ScreenshotRoutingModule,
		DailyStatisticsModule,
		GalleryModule,
		GauzyFiltersModule,
		NoDataMessageModule,
		ScreenshotsItemModule,
		SharedModule,
		ViewTimeLogModalModule
	]
})
export class ScreenshotModule {}
