import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbProgressBarModule } from '@nebular/theme';
import { ProgressStatusComponent } from './progress-status/progress-status.component';

@NgModule({
	imports: [CommonModule, NbProgressBarModule],
	declarations: [ProgressStatusComponent],
	exports: [ProgressStatusComponent]
})
export class ProgressStatusModule {}
