import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScreenCaptureComponent } from './screen-capture.component';
import { NbLayoutModule, NbCardModule } from '@nebular/theme';
@NgModule({
	declarations: [ScreenCaptureComponent],
	imports: [CommonModule, NbLayoutModule, NbCardModule],
	exports: [ScreenCaptureComponent]
})
export class ScreenCaptureModule {}
