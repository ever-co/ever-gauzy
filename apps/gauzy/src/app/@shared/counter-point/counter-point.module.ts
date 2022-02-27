import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CounterPointComponent } from './counter-point.component';
import { SharedModule } from 'apps/gauzy/src/app/@shared/shared.module';
import { NbProgressBarModule } from '@nebular/theme';



@NgModule({
  declarations: [
    CounterPointComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    NbProgressBarModule
  ],
  exports: [
    CounterPointComponent
  ]
})
export class CounterPointModule { }
