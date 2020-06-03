import { NgModule } from '@angular/core';
import { PipelinesComponent } from './pipelines.component';
import { NbCardModule, NbSelectModule } from '@nebular/theme';
import { PipelinesRouting } from './pipelines.routing';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { PipelinesService } from '../../@core/services/pipelines.service';



@NgModule( {
  declarations: [
    PipelinesComponent,
  ],
  exports: [
    PipelinesComponent,
  ],
  providers: [
    PipelinesService,
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
