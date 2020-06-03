import { NgModule } from '@angular/core';
import { PipelinesComponent } from './pipelines.component';
import { NbCardModule } from '@nebular/theme';
import { PipelinesRouting } from './pipelines.routing';



@NgModule( {
  declarations: [
    PipelinesComponent,
  ],
  exports: [
    PipelinesComponent,
  ],
  imports: [
    PipelinesRouting,
    NbCardModule,
  ],
})
export class PipelinesModule
{
}
