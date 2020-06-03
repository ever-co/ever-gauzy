import { NgModule } from '@angular/core';
import { PipelinesComponent } from './pipelines.component';
import { NbCardModule, NbSelectModule } from '@nebular/theme';
import { PipelinesRouting } from './pipelines.routing';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';



@NgModule( {
  declarations: [
    PipelinesComponent,
  ],
  exports: [
    PipelinesComponent,
  ],
  imports: [
    PipelinesRouting,
    TranslateModule,
    NbSelectModule,
    NbCardModule,
    CommonModule,
  ],
})
export class PipelinesModule
{
}
