import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ScreenshotRoutingModule } from './screenshot-routing.module';
import { ScreenshotComponent } from './screenshot/screenshot.component';
import { SharedModule } from 'apps/gauzy/src/app/@shared/shared.module';
import { FiltersModule } from 'apps/gauzy/src/app/@shared/timesheet/filters/filters.module';
import { NbSpinnerModule } from '@nebular/theme';

@NgModule({
	declarations: [ScreenshotComponent],
	imports: [
		CommonModule,
		ScreenshotRoutingModule,
		SharedModule,
		FiltersModule,
		NbSpinnerModule
	]
})
export class ScreenshotModule {}
