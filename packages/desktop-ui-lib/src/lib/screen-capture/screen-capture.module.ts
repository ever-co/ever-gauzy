import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScreenCaptureComponent } from './screen-capture.component';
import { NbLayoutModule, NbCardModule } from '@nebular/theme';

@NgModule({
    imports: [CommonModule, NbLayoutModule, NbCardModule, ScreenCaptureComponent],
    exports: [ScreenCaptureComponent],
})
export class ScreenCaptureModule {}
