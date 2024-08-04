import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NbProgressBarModule } from '@nebular/theme';
import { ProgressStatusComponent } from './progress-status.component';

@NgModule({
	imports: [CommonModule, NbProgressBarModule],
	declarations: [ProgressStatusComponent],
	exports: [ProgressStatusComponent]
})
export class ProgressStatusModule {}
