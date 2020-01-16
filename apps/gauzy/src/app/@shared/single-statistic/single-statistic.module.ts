import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SingleStatisticComponent } from './single-statistic.component';

@NgModule({
	declarations: [SingleStatisticComponent],
	exports: [SingleStatisticComponent],
	imports: [CommonModule]
})
export class SingleStatisticModule {}
