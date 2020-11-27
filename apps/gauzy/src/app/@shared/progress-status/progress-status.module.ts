import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProgressStatusComponent } from './progress-status/progress-status.component';
import { NbProgressBarModule } from '@nebular/theme';

@NgModule({
	declarations: [ProgressStatusComponent],
	exports: [ProgressStatusComponent],
	imports: [CommonModule, NbProgressBarModule]
})
export class ProgressStatusModule {}
