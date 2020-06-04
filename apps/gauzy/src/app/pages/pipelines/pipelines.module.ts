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
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { BrowserModule } from '@angular/platform-browser';



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
    ReactiveFormsModule,
    Ng2SmartTableModule,
    NbFormFieldModule,
    PipelinesRouting,
    TranslateModule,
    NbActionsModule,
    NbSelectModule,
    NbButtonModule,
    NbInputModule,
    CommonModule,
    NbCardModule,
    NbIconModule,
    FormsModule,
  ],
})
export class PipelinesModule
{
}
