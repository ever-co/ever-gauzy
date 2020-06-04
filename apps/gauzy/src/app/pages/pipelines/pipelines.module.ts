import { NgModule } from '@angular/core';
import { PipelinesComponent } from './pipelines.component';
import {
  NbActionsModule,
  NbButtonModule,
  NbCardModule,
  NbFormFieldModule,
  NbIconModule,
  NbInputModule,
  NbSelectModule,
} from '@nebular/theme';
import { PipelinesRouting } from './pipelines.routing';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { PipelinesService } from '../../@core/services/pipelines.service';
import { FormsModule } from '@angular/forms';



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
    NbInputModule,
    NbButtonModule,
    NbIconModule,
    NbActionsModule,
    FormsModule,
  ],
})
export class PipelinesModule
{
}
