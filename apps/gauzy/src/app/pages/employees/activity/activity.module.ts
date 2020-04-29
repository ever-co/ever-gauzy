import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ActivityRoutingModule } from './activity-routing.module';
import { ScreenshotComponent } from './screenshot/screenshot.component';

@NgModule({
	declarations: [ScreenshotComponent],
	imports: [CommonModule, ActivityRoutingModule]
})
export class ActivityModule {}
