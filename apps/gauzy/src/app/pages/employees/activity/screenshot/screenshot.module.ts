import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ScreenshotRoutingModule } from './screenshot-routing.module';
import { ScreenshotComponent } from './screenshot/screenshot.component';
import { SharedModule } from 'apps/gauzy/src/app/@shared/shared.module';
import { FiltersModule } from 'apps/gauzy/src/app/@shared/timesheet/filters/filters.module';
import { NbSpinnerModule, NbProgressBarModule } from '@nebular/theme';
import { MomentModule } from 'ngx-moment';

@NgModule({
	declarations: [ScreenshotComponent],
	imports: [
		CommonModule,
		ScreenshotRoutingModule,
		SharedModule,
		FiltersModule,
		NbSpinnerModule,
		MomentModule,
		NbProgressBarModule
	]
})
export class ScreenshotModule {}
