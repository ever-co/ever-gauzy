import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '@gauzy/ui-sdk/shared';
import { CounterPointComponent } from './counter-point.component';
import { NbProgressBarModule } from '@nebular/theme';

@NgModule({
	declarations: [CounterPointComponent],
	imports: [CommonModule, SharedModule, NbProgressBarModule],
	exports: [CounterPointComponent]
})
export class CounterPointModule {}
