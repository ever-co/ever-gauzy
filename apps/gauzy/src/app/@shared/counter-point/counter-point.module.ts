import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CounterPointComponent } from './counter-point.component';
import { SharedModule } from 'apps/gauzy/src/app/@shared/shared.module';



@NgModule({
  declarations: [
    CounterPointComponent
  ],
  imports: [
    CommonModule,
    SharedModule
  ],
  exports: [
    CounterPointComponent
  ]
})
export class CounterPointModule { }
