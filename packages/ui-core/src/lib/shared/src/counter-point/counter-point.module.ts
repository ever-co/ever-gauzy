import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbProgressBarModule } from '@nebular/theme';
import { SharedModule } from '../shared.module';
import { CounterPointComponent } from './counter-point.component';

@NgModule({
	declarations: [CounterPointComponent],
	imports: [CommonModule, SharedModule, NbProgressBarModule],
	exports: [CounterPointComponent]
})
export class CounterPointModule {}
