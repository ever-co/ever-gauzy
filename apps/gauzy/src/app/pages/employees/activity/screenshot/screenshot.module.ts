import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ScreenshotRoutingModule } from './screenshot-routing.module';
import { ScreenshotComponent } from './screenshot/screenshot.component';

@NgModule({
	declarations: [ScreenshotComponent],
	imports: [CommonModule, ScreenshotRoutingModule]
})
export class ScreenshotModule {}
